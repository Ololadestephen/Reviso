"""Immutable JSON contracts with atomic SQLite version checks."""

from __future__ import annotations

import hashlib
import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import timedelta
from uuid import uuid4

from backend.contracts import Evidence, utc_now
from backend.identity import LOCAL_USER_ID, OPERATOR_USER_ID, Principal
from backend.migrate import apply_migrations

SESSION_TTL = timedelta(days=14)
INFLIGHT_TTL = timedelta(minutes=3)


class ConflictError(Exception):
    pass


class DuplicateLlmRequest(Exception):
    pass


class LlmAllowanceExceeded(Exception):
    def __init__(self, scope: str):
        super().__init__(scope)
        self.scope = scope


class LlmLimits:
    def __init__(
        self,
        user_daily: int,
        total_daily: int,
        max_concurrent_user: int,
        max_concurrent_total: int,
    ):
        self.user_daily = user_daily
        self.total_daily = total_daily
        self.max_concurrent_user = max_concurrent_user
        self.max_concurrent_total = max_concurrent_total


class Repository:
    def __init__(self, path: str):
        self.path = path
        apply_migrations(path)

    @contextmanager
    def connect(self):
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def create(self, owner_id: str, payload: dict) -> dict:
        record = {
            "id": str(uuid4()),
            "version": 1,
            "confirmed": False,
            "retired": False,
            "parent_version": None,
            "created_at": utc_now().isoformat(),
            "thesis": payload,
        }
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO theses(owner_id, id, version, body) VALUES (?, ?, ?, ?)",
                (owner_id, record["id"], 1, json.dumps(record)),
            )
        return record

    def summaries(self, owner_id: str) -> list[dict]:
        """One row per thesis owned by this user: newest version plus selected assessment."""

        with self.connect() as connection:
            rows = connection.execute(
                "SELECT latest.body AS body, first.created_at AS created_at, "
                "selected.body AS assessment "
                "FROM (SELECT id, MAX(version) AS version FROM theses "
                "      WHERE owner_id=? GROUP BY id) AS newest "
                "JOIN theses AS latest "
                "  ON latest.owner_id=? AND latest.id = newest.id "
                " AND latest.version = newest.version "
                "JOIN (SELECT id, json_extract(body, '$.created_at') AS created_at "
                "      FROM theses WHERE owner_id=? AND version = 1) AS first "
                "  ON first.id = newest.id "
                "LEFT JOIN assessment_selection AS selection "
                "  ON selection.owner_id=? AND selection.thesis_id = newest.id "
                "LEFT JOIN assessments AS selected "
                "  ON selected.owner_id=selection.owner_id "
                " AND selected.input_hash = selection.input_hash "
                "ORDER BY latest.rowid DESC",
                (owner_id, owner_id, owner_id, owner_id),
            ).fetchall()
        return [self._summary(row) for row in rows]

    @staticmethod
    def _summary(row: sqlite3.Row) -> dict:
        record = json.loads(row["body"])
        assessment = json.loads(row["assessment"]) if row["assessment"] else None
        return {
            "id": record["id"],
            "version": record["version"],
            "confirmed": record["confirmed"],
            "retired": record["retired"],
            "created_at": row["created_at"],
            "updated_at": record["created_at"],
            "instrument_id": record["thesis"]["instrument_id"],
            "rationale": record["thesis"]["rationale"],
            "assumption_count": len(record["thesis"]["assumptions"]),
            "state": assessment["state"] if assessment else None,
            "mode": assessment["mode"] if assessment else None,
            "assessed_at": assessment["evaluated_at"] if assessment else None,
        }

    def get(self, owner_id: str, thesis_id: str) -> dict:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM theses WHERE owner_id=? AND id=? ORDER BY version DESC LIMIT 1",
                (owner_id, thesis_id),
            ).fetchone()
        if not row:
            raise KeyError(thesis_id)
        return json.loads(row["body"])

    def get_version(self, owner_id: str, thesis_id: str, version: int) -> dict:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM theses WHERE owner_id=? AND id=? AND version=?",
                (owner_id, thesis_id, version),
            ).fetchone()
        if not row:
            raise KeyError(f"{thesis_id}:{version}")
        return json.loads(row["body"])

    def evolve(
        self,
        owner_id: str,
        thesis_id: str,
        expected: int,
        changes: dict,
        event: dict,
        reassessment: dict | None = None,
    ) -> dict:
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT body FROM theses WHERE owner_id=? AND id=? ORDER BY version DESC LIMIT 1",
                (owner_id, thesis_id),
            ).fetchone()
            if not row:
                raise KeyError(thesis_id)
            previous = json.loads(row["body"])
            if previous["version"] != expected or previous["retired"]:
                raise ConflictError("Version changed or thesis retired; reload before deciding.")
            record = {
                **previous,
                **changes,
                "version": expected + 1,
                "parent_version": expected,
                "created_at": utc_now().isoformat(),
            }
            connection.execute(
                "INSERT INTO theses(owner_id, id, version, body) VALUES (?, ?, ?, ?)",
                (owner_id, thesis_id, record["version"], json.dumps(record)),
            )
            connection.execute(
                "INSERT INTO events(owner_id, thesis_id, body) VALUES (?, ?, ?)",
                (
                    owner_id,
                    thesis_id,
                    json.dumps({**event, "version": record["version"], "at": record["created_at"]}),
                ),
            )
            if reassessment is not None:
                self._save_assessment(
                    connection, owner_id, thesis_id, record["version"], reassessment
                )
        return record

    @staticmethod
    def _save_assessment(
        connection: sqlite3.Connection,
        owner_id: str,
        thesis_id: str,
        version: int,
        assessment: dict,
    ) -> dict:
        if assessment["thesis_id"] != thesis_id or assessment["thesis_version"] != version:
            raise ValueError("Assessment must match the saved thesis version")
        connection.execute(
            "INSERT OR IGNORE INTO assessments(owner_id, input_hash, thesis_id, version, body) "
            "VALUES (?, ?, ?, ?, ?)",
            (owner_id, assessment["input_hash"], thesis_id, version, json.dumps(assessment)),
        )
        saved = connection.execute(
            "SELECT body FROM assessments WHERE owner_id=? AND input_hash=?",
            (owner_id, assessment["input_hash"]),
        ).fetchone()
        connection.execute(
            "INSERT INTO assessment_selection(owner_id, thesis_id, input_hash) VALUES (?, ?, ?) "
            "ON CONFLICT(owner_id, thesis_id) DO UPDATE SET input_hash=excluded.input_hash",
            (owner_id, thesis_id, assessment["input_hash"]),
        )
        return json.loads(saved["body"])

    def assess(self, owner_id: str, thesis_id: str, expected: int, assessment: dict) -> dict:
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT body FROM theses WHERE owner_id=? AND id=? ORDER BY version DESC LIMIT 1",
                (owner_id, thesis_id),
            ).fetchone()
            if not row:
                raise KeyError(thesis_id)
            current = json.loads(row["body"])
            if current["version"] != expected or current["retired"]:
                raise ConflictError("Thesis changed during assessment")
            return self._save_assessment(connection, owner_id, thesis_id, expected, assessment)

    def assessment_by_hash(self, owner_id: str, thesis_id: str, input_hash: str) -> dict | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM assessments WHERE owner_id=? AND thesis_id=? AND input_hash=?",
                (owner_id, thesis_id, input_hash),
            ).fetchone()
        return json.loads(row["body"]) if row else None

    def save_research_answer(self, owner_id: str, answer: dict) -> dict:
        with self.connect() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO research_answers "
                "(owner_id, input_hash, id, thesis_id, version, assessment_input_hash, "
                "created_at, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    owner_id,
                    answer["input_hash"],
                    answer["id"],
                    answer["thesis_id"],
                    answer["thesis_version"],
                    answer["assessment_input_hash"],
                    answer["created_at"],
                    json.dumps(answer),
                ),
            )
            row = connection.execute(
                "SELECT body FROM research_answers WHERE owner_id=? AND input_hash=?",
                (owner_id, answer["input_hash"]),
            ).fetchone()
        return json.loads(row["body"])

    def research_answer_by_hash(
        self, owner_id: str, thesis_id: str, input_hash: str
    ) -> dict | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM research_answers "
                "WHERE owner_id=? AND thesis_id=? AND input_hash=?",
                (owner_id, thesis_id, input_hash),
            ).fetchone()
        return json.loads(row["body"]) if row else None

    def research_answers(
        self, owner_id: str, thesis_id: str, max_version: int | None = None
    ) -> list[dict]:
        self.get(owner_id, thesis_id)
        query = "SELECT body FROM research_answers WHERE owner_id=? AND thesis_id=?"
        parameters: tuple = (owner_id, thesis_id)
        if max_version is not None:
            query += " AND version<=?"
            parameters = (owner_id, thesis_id, max_version)
        query += " ORDER BY created_at, id"
        with self.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [json.loads(row["body"]) for row in rows]

    def assessment_with_narrative(
        self, owner_id: str, thesis_id: str, context_hash: str
    ) -> dict | None:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT body FROM assessments WHERE owner_id=? AND thesis_id=? ORDER BY rowid DESC",
                (owner_id, thesis_id),
            ).fetchall()
        for row in rows:
            body = json.loads(row["body"])
            if body.get("narrative_context_hash") == context_hash and body.get("narrative_review"):
                return body
        return None

    def thread(self, owner_id: str, thesis_id: str, context_hash: str) -> dict | None:
        self.get(owner_id, thesis_id)
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM research_threads "
                "WHERE owner_id=? AND thesis_id=? AND context_hash=?",
                (owner_id, thesis_id, context_hash),
            ).fetchone()
        return json.loads(row["body"]) if row else None

    def save_thread(self, owner_id: str, thread: dict) -> dict:
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO research_threads (owner_id, thesis_id, context_hash, body) "
                "VALUES (?, ?, ?, ?) "
                "ON CONFLICT(owner_id, thesis_id, context_hash) DO UPDATE SET body=excluded.body",
                (owner_id, thread["thesis_id"], thread["context_hash"], json.dumps(thread)),
            )
        return thread

    def evidence(self, owner_id: str, evidence_id: str) -> Evidence:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT e.value FROM assessments a, json_each(a.body, '$.evidence') e "
                "WHERE a.owner_id=? AND json_extract(e.value, '$.id')=? "
                "ORDER BY a.rowid LIMIT 1",
                (owner_id, evidence_id),
            ).fetchone()
        if row is None:
            raise KeyError(evidence_id)
        return Evidence.model_validate_json(row["value"])

    def history(self, owner_id: str, thesis_id: str) -> dict:
        self.get(owner_id, thesis_id)
        with self.connect() as connection:
            history = {
                key: [
                    json.loads(row["body"])
                    for row in connection.execute(query, (owner_id, thesis_id))
                ]
                for key, query in {
                    "versions": (
                        "SELECT body FROM theses WHERE owner_id=? AND id=? ORDER BY version"
                    ),
                    "assessments": (
                        "SELECT body FROM assessments WHERE owner_id=? AND thesis_id=? "
                        "ORDER BY rowid"
                    ),
                    "events": (
                        "SELECT body FROM events WHERE owner_id=? AND thesis_id=? ORDER BY id"
                    ),
                }.items()
            }
            selected = connection.execute(
                "SELECT a.body FROM assessments a JOIN assessment_selection s "
                "ON a.owner_id=s.owner_id AND a.input_hash=s.input_hash "
                "WHERE s.owner_id=? AND s.thesis_id=?",
                (owner_id, thesis_id),
            ).fetchone()
            history["selected_assessment"] = json.loads(selected["body"]) if selected else None
            return history

    def user_for_identity(
        self,
        issuer: str,
        subject: str,
        *,
        email: str | None,
        display_name: str | None,
        kind: str = "person",
    ) -> dict:
        """Resolve issuer+subject to a user. Matching email never merges accounts."""

        now = utc_now().isoformat()
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT user_id FROM identities WHERE issuer=? AND subject=?",
                (issuer, subject),
            ).fetchone()
            if row:
                user_id = row["user_id"]
                connection.execute(
                    "UPDATE identities SET email=?, last_seen_at=? WHERE issuer=? AND subject=?",
                    (email, now, issuer, subject),
                )
                if display_name:
                    connection.execute(
                        "UPDATE users SET display_name=? WHERE id=? AND kind='person'",
                        (display_name, user_id),
                    )
            else:
                user_id = str(uuid4())
                connection.execute(
                    "INSERT INTO users(id, kind, created_at, display_name) VALUES (?, ?, ?, ?)",
                    (user_id, kind, now, display_name or "Researcher"),
                )
                connection.execute(
                    "INSERT INTO identities(issuer, subject, user_id, email, created_at, last_seen_at) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (issuer, subject, user_id, email, now, now),
                )
            return self._user_row(connection, user_id)

    def user_by_id(self, user_id: str) -> dict | None:
        with self.connect() as connection:
            return self._user_row(connection, user_id)

    @staticmethod
    def _user_row(connection: sqlite3.Connection, user_id: str) -> dict | None:
        row = connection.execute(
            "SELECT id, kind, created_at, display_name FROM users WHERE id=?",
            (user_id,),
        ).fetchone()
        if not row:
            return None
        identity = connection.execute(
            "SELECT issuer, email FROM identities WHERE user_id=? ORDER BY last_seen_at DESC",
            (user_id,),
        ).fetchone()
        return {
            "id": row["id"],
            "kind": row["kind"],
            "created_at": row["created_at"],
            "display_name": row["display_name"],
            "issuer": identity["issuer"] if identity else None,
            "email": identity["email"] if identity else None,
        }

    def create_session(self, user_id: str) -> tuple[str, str, str]:
        raw = secrets.token_urlsafe(32)
        csrf = secrets.token_urlsafe(32)
        now = utc_now()
        expires = (now + SESSION_TTL).isoformat()
        token_hash = _token_hash(raw)
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO sessions(token_hash, user_id, csrf_secret, created_at, expires_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (token_hash, user_id, csrf, now.isoformat(), expires),
            )
        return raw, csrf, expires

    def session_principal(self, raw_token: str, auth: str) -> Principal | None:
        token_hash = _token_hash(raw_token)
        now = utc_now().isoformat()
        with self.connect() as connection:
            row = connection.execute(
                "SELECT s.user_id, s.csrf_secret, s.expires_at, u.kind, u.display_name "
                "FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?",
                (token_hash,),
            ).fetchone()
            if not row or row["expires_at"] <= now:
                if row:
                    connection.execute("DELETE FROM sessions WHERE token_hash=?", (token_hash,))
                return None
            identity = connection.execute(
                "SELECT email, issuer FROM identities WHERE user_id=? ORDER BY last_seen_at DESC",
                (row["user_id"],),
            ).fetchone()
        return Principal(
            user_id=row["user_id"],
            kind=row["kind"],
            auth=auth,
            email=identity["email"] if identity else None,
            display_name=row["display_name"] or "Researcher",
            csrf_secret=row["csrf_secret"],
        )

    def delete_session(self, raw_token: str) -> None:
        with self.connect() as connection:
            connection.execute("DELETE FROM sessions WHERE token_hash=?", (_token_hash(raw_token),))

    def local_principal(self) -> Principal:
        user = self.user_by_id(LOCAL_USER_ID)
        if not user:
            raise RuntimeError("Local identity is missing from the database")
        return Principal(
            user_id=LOCAL_USER_ID,
            kind="local",
            auth="local",
            email=None,
            display_name=user["display_name"] or "Local researcher",
        )

    def operator_instrument_ids(self) -> list[str]:
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT DISTINCT json_extract(body, '$.thesis.instrument_id') AS instrument_id "
                "FROM theses WHERE owner_id=? AND instrument_id IS NOT NULL "
                "ORDER BY instrument_id",
                (OPERATOR_USER_ID,),
            ).fetchall()
        return [row["instrument_id"] for row in rows if row["instrument_id"]]

    def acquire_llm_slot(self, owner_id: str, request_key: str, limits: LlmLimits) -> None:
        now = utc_now()
        stale = (now - INFLIGHT_TTL).isoformat()
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("DELETE FROM llm_inflight WHERE created_at < ?", (stale,))
            duplicate = connection.execute(
                "SELECT 1 FROM llm_inflight WHERE user_id=? AND request_key=?",
                (owner_id, request_key),
            ).fetchone()
            if duplicate:
                raise DuplicateLlmRequest()
            user_inflight = connection.execute(
                "SELECT COUNT(*) AS n FROM llm_inflight WHERE user_id=?", (owner_id,)
            ).fetchone()["n"]
            total_inflight = connection.execute(
                "SELECT COUNT(*) AS n FROM llm_inflight"
            ).fetchone()["n"]
            if user_inflight >= limits.max_concurrent_user:
                raise LlmAllowanceExceeded("concurrent_user")
            if total_inflight >= limits.max_concurrent_total:
                raise LlmAllowanceExceeded("concurrent_total")
            day = now.date().isoformat()
            user_used = _usage(connection, owner_id, day)
            total_used = _total_usage(connection, day)
            if limits.user_daily and user_used >= limits.user_daily:
                raise LlmAllowanceExceeded("user")
            if limits.total_daily and total_used >= limits.total_daily:
                raise LlmAllowanceExceeded("total")
            connection.execute(
                "INSERT INTO llm_inflight(user_id, request_key, created_at) VALUES (?, ?, ?)",
                (owner_id, request_key, now.isoformat()),
            )

    def consume_llm_allowance(self, owner_id: str, count: int, limits: LlmLimits) -> None:
        if count <= 0:
            return
        day = utc_now().date().isoformat()
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            user_used = _usage(connection, owner_id, day)
            total_used = _total_usage(connection, day)
            if limits.user_daily and user_used + count > limits.user_daily:
                raise LlmAllowanceExceeded("user")
            if limits.total_daily and total_used + count > limits.total_daily:
                raise LlmAllowanceExceeded("total")
            connection.execute(
                "INSERT INTO llm_usage_days(user_id, day, provider_requests) VALUES (?, ?, ?) "
                "ON CONFLICT(user_id, day) DO UPDATE SET "
                "provider_requests=provider_requests + excluded.provider_requests",
                (owner_id, day, count),
            )

    def release_llm_slot(self, owner_id: str, request_key: str) -> None:
        with self.connect() as connection:
            connection.execute(
                "DELETE FROM llm_inflight WHERE user_id=? AND request_key=?",
                (owner_id, request_key),
            )

    def llm_usage(self, owner_id: str) -> dict[str, int]:
        day = utc_now().date().isoformat()
        with self.connect() as connection:
            return {
                "day": day,
                "user": _usage(connection, owner_id, day),
                "total": _total_usage(connection, day),
            }


def _usage(connection: sqlite3.Connection, owner_id: str, day: str) -> int:
    row = connection.execute(
        "SELECT provider_requests FROM llm_usage_days WHERE user_id=? AND day=?",
        (owner_id, day),
    ).fetchone()
    return int(row["provider_requests"]) if row else 0


def _total_usage(connection: sqlite3.Connection, day: str) -> int:
    row = connection.execute(
        "SELECT COALESCE(SUM(provider_requests), 0) AS n FROM llm_usage_days WHERE day=?",
        (day,),
    ).fetchone()
    return int(row["n"])


def _token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
