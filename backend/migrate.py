"""Numbered SQLite migrations applied in one transaction each.

executescript() issues a COMMIT first, so upgrades run statement-by-statement
inside BEGIN IMMEDIATE. A failed upgrade rolls back schema and data together.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path

from backend.contracts import utc_now
from backend.identity import LOCAL_USER_ID, OPERATOR_USER_ID

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


class MigrationError(RuntimeError):
    pass


def apply_migrations(
    path: str, *, stop_after: int | None = None, extras: dict | None = None
) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.isolation_level = None
    try:
        connection.execute("PRAGMA foreign_keys = ON")
        plan = _migration_plan()
        if extras:
            plan = sorted((*plan, *extras.items()), key=lambda item: item[0])
        for version, runner in plan:
            if stop_after is not None and version > stop_after:
                break
            if _has_version(connection, version):
                continue
            connection.execute("BEGIN IMMEDIATE")
            try:
                runner(connection)
                if not _has_version(connection, version):
                    connection.execute(
                        "INSERT INTO schema_migrations(version) VALUES (?)", (version,)
                    )
                connection.execute("COMMIT")
            except Exception:
                connection.execute("ROLLBACK")
                raise
        if stop_after is None:
            _assert_foreign_keys(connection)
    finally:
        connection.close()


def _migration_plan() -> list[tuple[int, Callable[[sqlite3.Connection], None]]]:
    plan: list[tuple[int, Callable[[sqlite3.Connection], None]]] = []
    for migration in sorted(MIGRATIONS_DIR.glob("*.sql")):
        version = int(migration.stem.split("_", maxsplit=1)[0])
        sql = migration.read_text()
        plan.append((version, lambda connection, script=sql: _run_sql(connection, script)))
    plan.append((6, apply_ownership_migration))
    return sorted(plan, key=lambda item: item[0])


def _has_version(connection: sqlite3.Connection, version: int) -> bool:
    if not _table_exists(connection, "schema_migrations"):
        return False
    return (
        connection.execute("SELECT 1 FROM schema_migrations WHERE version=?", (version,)).fetchone()
        is not None
    )


def _table_exists(connection: sqlite3.Connection, name: str) -> bool:
    return (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)
        ).fetchone()
        is not None
    )


def _run_sql(connection: sqlite3.Connection, script: str) -> None:
    for statement in _sql_statements(script):
        connection.execute(statement)


def _sql_statements(script: str) -> list[str]:
    statements: list[str] = []
    buffer: list[str] = []
    for line in script.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        buffer.append(line)
        if stripped.endswith(";"):
            statement = "\n".join(buffer).strip().rstrip(";")
            if statement:
                statements.append(statement)
            buffer = []
    tail = "\n".join(buffer).strip().rstrip(";")
    if tail:
        statements.append(tail)
    return statements


def _assert_foreign_keys(connection: sqlite3.Connection) -> None:
    violations = connection.execute("PRAGMA foreign_key_check").fetchall()
    if violations:
        raise MigrationError(f"Foreign key check failed: {violations[:5]}")


def apply_ownership_migration(connection: sqlite3.Connection) -> None:
    """Assign existing research to the reserved operator account."""

    created_at = utc_now().isoformat()
    connection.execute(
        """
        CREATE TABLE users (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL CHECK (kind IN ('person', 'operator', 'local')),
            created_at TEXT NOT NULL,
            display_name TEXT
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE identities (
            issuer TEXT NOT NULL,
            subject TEXT NOT NULL,
            user_id TEXT NOT NULL REFERENCES users(id),
            email TEXT,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            PRIMARY KEY (issuer, subject)
        )
        """
    )
    connection.execute("CREATE INDEX identities_user ON identities(user_id)")
    connection.execute(
        """
        CREATE TABLE sessions (
            token_hash TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            csrf_secret TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL
        )
        """
    )
    connection.execute("CREATE INDEX sessions_user ON sessions(user_id)")
    connection.execute(
        """
        CREATE TABLE llm_usage_days (
            user_id TEXT NOT NULL,
            day TEXT NOT NULL,
            provider_requests INTEGER NOT NULL,
            PRIMARY KEY (user_id, day),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE llm_inflight (
            user_id TEXT NOT NULL,
            request_key TEXT NOT NULL,
            created_at TEXT NOT NULL,
            PRIMARY KEY (user_id, request_key)
        )
        """
    )
    connection.execute(
        "INSERT INTO users(id, kind, created_at, display_name) VALUES (?, 'operator', ?, ?)",
        (OPERATOR_USER_ID, created_at, "Operator"),
    )
    connection.execute(
        "INSERT INTO users(id, kind, created_at, display_name) VALUES (?, 'local', ?, ?)",
        (LOCAL_USER_ID, created_at, "Local researcher"),
    )
    connection.execute(
        """
        INSERT INTO identities(issuer, subject, user_id, email, created_at, last_seen_at)
        VALUES ('local', 'local', ?, NULL, ?, ?)
        """,
        (LOCAL_USER_ID, created_at, created_at),
    )

    connection.execute(
        """
        CREATE TABLE theses_v6 (
            owner_id TEXT NOT NULL,
            id TEXT NOT NULL,
            version INTEGER NOT NULL,
            body TEXT NOT NULL,
            PRIMARY KEY (owner_id, id, version),
            FOREIGN KEY (owner_id) REFERENCES users(id)
        )
        """
    )
    connection.execute(
        "INSERT INTO theses_v6(owner_id, id, version, body) SELECT ?, id, version, body FROM theses",
        (OPERATOR_USER_ID,),
    )

    connection.execute(
        """
        CREATE TABLE assessments_v6 (
            owner_id TEXT NOT NULL,
            input_hash TEXT NOT NULL,
            thesis_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            body TEXT NOT NULL,
            PRIMARY KEY (owner_id, input_hash),
            FOREIGN KEY (owner_id, thesis_id, version)
                REFERENCES theses_v6(owner_id, id, version)
        )
        """
    )
    connection.execute(
        """
        INSERT INTO assessments_v6(owner_id, input_hash, thesis_id, version, body)
        SELECT ?, input_hash, thesis_id, version, body FROM assessments
        """,
        (OPERATOR_USER_ID,),
    )

    connection.execute(
        """
        CREATE TABLE assessment_selection_v6 (
            owner_id TEXT NOT NULL,
            thesis_id TEXT NOT NULL,
            input_hash TEXT NOT NULL,
            PRIMARY KEY (owner_id, thesis_id),
            FOREIGN KEY (owner_id, input_hash) REFERENCES assessments_v6(owner_id, input_hash)
        )
        """
    )
    connection.execute(
        """
        INSERT INTO assessment_selection_v6(owner_id, thesis_id, input_hash)
        SELECT ?, thesis_id, input_hash FROM assessment_selection
        """,
        (OPERATOR_USER_ID,),
    )

    connection.execute(
        """
        CREATE TABLE events_v6 (
            id INTEGER PRIMARY KEY,
            owner_id TEXT NOT NULL,
            thesis_id TEXT NOT NULL,
            body TEXT NOT NULL,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        )
        """
    )
    connection.execute(
        "INSERT INTO events_v6(id, owner_id, thesis_id, body) SELECT id, ?, thesis_id, body FROM events",
        (OPERATOR_USER_ID,),
    )

    connection.execute(
        """
        CREATE TABLE research_answers_v6 (
            owner_id TEXT NOT NULL,
            input_hash TEXT NOT NULL,
            id TEXT NOT NULL,
            thesis_id TEXT NOT NULL,
            version INTEGER NOT NULL,
            assessment_input_hash TEXT NOT NULL,
            created_at TEXT NOT NULL,
            body TEXT NOT NULL,
            PRIMARY KEY (owner_id, input_hash),
            UNIQUE (owner_id, id),
            FOREIGN KEY (owner_id, thesis_id, version)
                REFERENCES theses_v6(owner_id, id, version)
        )
        """
    )
    connection.execute(
        """
        INSERT INTO research_answers_v6(
            owner_id, input_hash, id, thesis_id, version, assessment_input_hash, created_at, body
        )
        SELECT ?, input_hash, id, thesis_id, version, assessment_input_hash, created_at, body
        FROM research_answers
        """,
        (OPERATOR_USER_ID,),
    )

    connection.execute(
        """
        CREATE TABLE research_threads_v6 (
            owner_id TEXT NOT NULL,
            thesis_id TEXT NOT NULL,
            context_hash TEXT NOT NULL,
            body TEXT NOT NULL,
            PRIMARY KEY (owner_id, thesis_id, context_hash)
        )
        """
    )
    connection.execute(
        """
        INSERT INTO research_threads_v6(owner_id, thesis_id, context_hash, body)
        SELECT ?, thesis_id, context_hash, body FROM research_threads
        """,
        (OPERATOR_USER_ID,),
    )
    connection.execute("DROP TABLE assessment_selection")
    connection.execute("DROP TABLE assessments")
    connection.execute("DROP TABLE research_answers")
    connection.execute("DROP TABLE events")
    connection.execute("DROP TABLE research_threads")
    connection.execute("DROP TABLE theses")
    connection.execute("ALTER TABLE theses_v6 RENAME TO theses")
    connection.execute("ALTER TABLE assessments_v6 RENAME TO assessments")
    connection.execute("ALTER TABLE assessment_selection_v6 RENAME TO assessment_selection")
    connection.execute("ALTER TABLE events_v6 RENAME TO events")
    connection.execute("ALTER TABLE research_answers_v6 RENAME TO research_answers")
    connection.execute("ALTER TABLE research_threads_v6 RENAME TO research_threads")
    connection.execute("CREATE INDEX theses_owner_lookup ON theses(owner_id, id)")
    connection.execute("CREATE INDEX events_owner_thesis ON events(owner_id, thesis_id, id)")
    connection.execute(
        """
        CREATE INDEX research_answers_owner_thesis
        ON research_answers(owner_id, thesis_id, version, created_at)
        """
    )
    connection.execute("INSERT OR IGNORE INTO schema_migrations(version) VALUES (6)")
