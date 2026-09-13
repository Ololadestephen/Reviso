"""Immutable JSON contracts with atomic SQLite version checks."""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from uuid import uuid4

from backend.contracts import Evidence, utc_now


class ConflictError(Exception):
    pass


class Repository:
    def __init__(self, path: str):
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as connection:
            for migration in sorted((Path(__file__).parent / "migrations").glob("*.sql")):
                connection.executescript(migration.read_text())

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

    def create(self, payload: dict) -> dict:
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
                "INSERT INTO theses VALUES (?, ?, ?)", (record["id"], 1, json.dumps(record))
            )
        return record

    def summaries(self) -> list[dict]:
        """One row per thesis: its newest version plus its selected assessment.

        `created_at` on a stored record is that version's timestamp, so the
        original creation time is read from version 1 and the newest version
        supplies `updated_at`.
        """
        with self.connect() as connection:
            rows = connection.execute(
                "SELECT latest.body AS body, first.created_at AS created_at, "
                "selected.body AS assessment "
                "FROM (SELECT id, MAX(version) AS version FROM theses GROUP BY id) AS newest "
                "JOIN theses AS latest "
                "  ON latest.id = newest.id AND latest.version = newest.version "
                "JOIN (SELECT id, json_extract(body, '$.created_at') AS created_at "
                "      FROM theses WHERE version = 1) AS first ON first.id = newest.id "
                "LEFT JOIN assessment_selection AS selection ON selection.thesis_id = newest.id "
                "LEFT JOIN assessments AS selected "
                "  ON selected.input_hash = selection.input_hash "
                "ORDER BY latest.rowid DESC"
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

    def get(self, thesis_id: str) -> dict:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM theses WHERE id=? ORDER BY version DESC LIMIT 1", (thesis_id,)
            ).fetchone()
        if not row:
            raise KeyError(thesis_id)
        return json.loads(row["body"])

    def get_version(self, thesis_id: str, version: int) -> dict:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM theses WHERE id=? AND version=?", (thesis_id, version)
            ).fetchone()
        if not row:
            raise KeyError(f"{thesis_id}:{version}")
        return json.loads(row["body"])

    def evolve(
        self,
        thesis_id: str,
        expected: int,
        changes: dict,
        event: dict,
        reassessment: dict | None = None,
    ) -> dict:
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT body FROM theses WHERE id=? ORDER BY version DESC LIMIT 1", (thesis_id,)
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
                "INSERT INTO theses VALUES (?, ?, ?)",
                (thesis_id, record["version"], json.dumps(record)),
            )
            connection.execute(
                "INSERT INTO events(thesis_id, body) VALUES (?, ?)",
                (
                    thesis_id,
                    json.dumps({**event, "version": record["version"], "at": record["created_at"]}),
                ),
            )
            if reassessment is not None:
                self._save_assessment(connection, thesis_id, record["version"], reassessment)
        return record

    @staticmethod
    def _save_assessment(
        connection: sqlite3.Connection, thesis_id: str, version: int, assessment: dict
    ) -> dict:
        if assessment["thesis_id"] != thesis_id or assessment["thesis_version"] != version:
            raise ValueError("Assessment must match the saved thesis version")
        connection.execute(
            "INSERT OR IGNORE INTO assessments VALUES (?, ?, ?, ?)",
            (assessment["input_hash"], thesis_id, version, json.dumps(assessment)),
        )
        saved = connection.execute(
            "SELECT body FROM assessments WHERE input_hash=?", (assessment["input_hash"],)
        ).fetchone()
        connection.execute(
            "INSERT INTO assessment_selection VALUES (?, ?) "
            "ON CONFLICT(thesis_id) DO UPDATE SET input_hash=excluded.input_hash",
            (thesis_id, assessment["input_hash"]),
        )
        return json.loads(saved["body"])

    def assess(self, thesis_id: str, expected: int, assessment: dict) -> dict:
        with self.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT body FROM theses WHERE id=? ORDER BY version DESC LIMIT 1", (thesis_id,)
            ).fetchone()
            if not row:
                raise KeyError(thesis_id)
            current = json.loads(row["body"])
            if current["version"] != expected or current["retired"]:
                raise ConflictError("Thesis changed during assessment")
            return self._save_assessment(connection, thesis_id, expected, assessment)

    def assessment_by_hash(self, thesis_id: str, input_hash: str) -> dict | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM assessments WHERE thesis_id=? AND input_hash=?",
                (thesis_id, input_hash),
            ).fetchone()
        return json.loads(row["body"]) if row else None

    def save_research_answer(self, answer: dict) -> dict:
        with self.connect() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO research_answers "
                "(input_hash, id, thesis_id, version, assessment_input_hash, created_at, body) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
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
                "SELECT body FROM research_answers WHERE input_hash=?",
                (answer["input_hash"],),
            ).fetchone()
        return json.loads(row["body"])

    def research_answer_by_hash(self, thesis_id: str, input_hash: str) -> dict | None:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT body FROM research_answers WHERE thesis_id=? AND input_hash=?",
                (thesis_id, input_hash),
            ).fetchone()
        return json.loads(row["body"]) if row else None

    def research_answers(self, thesis_id: str, max_version: int | None = None) -> list[dict]:
        self.get(thesis_id)
        query = "SELECT body FROM research_answers WHERE thesis_id=?"
        parameters: tuple = (thesis_id,)
        if max_version is not None:
            query += " AND version<=?"
            parameters = (thesis_id, max_version)
        query += " ORDER BY created_at, id"
        with self.connect() as connection:
            rows = connection.execute(query, parameters).fetchall()
        return [json.loads(row["body"]) for row in rows]

    def evidence(self, evidence_id: str) -> Evidence:
        with self.connect() as connection:
            row = connection.execute(
                "SELECT e.value FROM assessments a, json_each(a.body, '$.evidence') e "
                "WHERE json_extract(e.value, '$.id')=? ORDER BY a.rowid LIMIT 1",
                (evidence_id,),
            ).fetchone()
        if row is None:
            raise KeyError(evidence_id)
        return Evidence.model_validate_json(row["value"])

    def history(self, thesis_id: str) -> dict:
        self.get(thesis_id)
        with self.connect() as connection:
            history = {
                key: [json.loads(row["body"]) for row in connection.execute(query, (thesis_id,))]
                for key, query in {
                    "versions": "SELECT body FROM theses WHERE id=? ORDER BY version",
                    "assessments": "SELECT body FROM assessments WHERE thesis_id=? ORDER BY rowid",
                    "events": "SELECT body FROM events WHERE thesis_id=? ORDER BY id",
                }.items()
            }
            selected = connection.execute(
                "SELECT a.body FROM assessments a JOIN assessment_selection s "
                "ON a.input_hash=s.input_hash WHERE s.thesis_id=?",
                (thesis_id,),
            ).fetchone()
            history["selected_assessment"] = json.loads(selected["body"]) if selected else None
            return history
