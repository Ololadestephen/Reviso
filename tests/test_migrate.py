import json
import sqlite3

import pytest

from backend.identity import LOCAL_USER_ID, OPERATOR_USER_ID
from backend.migrate import apply_migrations
from backend.storage import Repository


def test_v5_research_is_assigned_to_the_operator_account(tmp_path, thesis):
    path = str(tmp_path / "legacy-v5.sqlite3")
    apply_migrations(path, stop_after=5)
    thesis_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    record = {
        "id": thesis_id,
        "version": 1,
        "confirmed": True,
        "retired": False,
        "parent_version": None,
        "created_at": "2026-09-12T12:00:00+00:00",
        "thesis": thesis.model_dump(mode="json"),
    }
    assessment = {
        "input_hash": "b" * 64,
        "thesis_id": thesis_id,
        "thesis_version": 1,
        "state": "SUPPORTED",
        "mode": "LIVE_REFRESH",
        "evaluated_at": "2026-09-12T12:01:00+00:00",
        "evidence": [
            {
                "id": "operator-only-source",
                "instrument_id": "RNVDAUSDT",
                "publisher": "SEC",
                "source_url": "https://www.sec.gov/example",
                "title": "Operator filing",
                "excerpt": "A saved excerpt that must not leak to other accounts.",
                "published_at": "2026-08-01T00:00:00+00:00",
                "available_at": "2026-08-02T00:00:00+00:00",
                "observed_at": "2026-08-01T00:00:00+00:00",
                "retrieved_at": "2026-09-12T12:01:00+00:00",
                "content_hash": "c" * 64,
                "duplicate_family": "operator-source",
                "scope": "NVIDIA",
                "limitations": "Saved assessment excerpt.",
                "metrics": {},
            }
        ],
    }
    thread = {"thesis_id": thesis_id, "context_hash": "legacy-context", "messages": []}
    with sqlite3.connect(path) as connection:
        connection.execute(
            "INSERT INTO theses VALUES (?, ?, ?)", (thesis_id, 1, json.dumps(record))
        )
        connection.execute(
            "INSERT INTO assessments VALUES (?, ?, ?, ?)",
            (assessment["input_hash"], thesis_id, 1, json.dumps(assessment)),
        )
        connection.execute(
            "INSERT INTO assessment_selection VALUES (?, ?)",
            (thesis_id, assessment["input_hash"]),
        )
        connection.execute(
            "INSERT INTO research_threads VALUES (?, ?, ?)",
            (thesis_id, "legacy-context", json.dumps(thread)),
        )
        connection.execute(
            "INSERT INTO events(thesis_id, body) VALUES (?, ?)",
            (
                thesis_id,
                json.dumps({"kind": "confirm", "at": "2026-09-12T12:00:00+00:00"}),
            ),
        )
        connection.execute(
            "INSERT INTO research_answers VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "d" * 64,
                "answer-legacy-1",
                thesis_id,
                1,
                assessment["input_hash"],
                "2026-09-12T12:02:00+00:00",
                json.dumps({"id": "answer-legacy-1", "question": "Why?"}),
            ),
        )
        connection.commit()

    repo = Repository(path)
    summaries = repo.summaries(OPERATOR_USER_ID)
    assert len(summaries) == 1
    assert summaries[0]["id"] == thesis_id
    assert summaries[0]["instrument_id"] == "RNVDAUSDT"
    assert repo.summaries(LOCAL_USER_ID) == []
    assert repo.thread(OPERATOR_USER_ID, thesis_id, "legacy-context") == thread
    assert repo.research_answers(OPERATOR_USER_ID, thesis_id)[0]["id"] == "answer-legacy-1"
    with pytest.raises(KeyError):
        repo.research_answers(LOCAL_USER_ID, thesis_id)
    assert repo.evidence(OPERATOR_USER_ID, "operator-only-source").id == "operator-only-source"
    with pytest.raises(KeyError):
        repo.evidence(LOCAL_USER_ID, "operator-only-source")
    assert repo.operator_instrument_ids() == ["RNVDAUSDT"]
    with sqlite3.connect(path) as connection:
        versions = {
            row[0] for row in connection.execute("SELECT version FROM schema_migrations").fetchall()
        }
    assert {1, 2, 3, 4, 5, 6} <= versions


def test_failed_upgrade_rolls_back_schema_and_keeps_research(tmp_path, thesis):
    path = str(tmp_path / "rollback.sqlite3")
    repo = Repository(path)
    draft = repo.create(LOCAL_USER_ID, thesis.model_dump(mode="json"))

    def boom(connection):
        connection.execute("CREATE TABLE should_not_remain (id TEXT)")
        connection.execute("INSERT INTO should_not_remain VALUES ('x')")
        raise RuntimeError("injected failure")

    with pytest.raises(RuntimeError, match="injected failure"):
        apply_migrations(path, extras={99: boom})

    restored = Repository(path)
    assert restored.get(LOCAL_USER_ID, draft["id"])["id"] == draft["id"]
    with sqlite3.connect(path) as connection:
        assert (
            connection.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='should_not_remain'"
            ).fetchone()
            is None
        )
        assert (
            connection.execute("SELECT 1 FROM schema_migrations WHERE version=99").fetchone()
            is None
        )
