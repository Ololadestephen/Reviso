import sqlite3

import pytest

from backend.storage import Repository


def test_revision_and_reassessment_roll_back_together(tmp_path, thesis):
    repo = Repository(str(tmp_path / "atomic.sqlite3"))
    draft = repo.create(thesis.model_dump(mode="json"))
    # Rejecting a mismatched assessment must not leave a new version or event.
    with pytest.raises(ValueError, match="match"):
        repo.evolve(
            draft["id"],
            1,
            {"confirmed": True},
            {"action": "confirm"},
            reassessment={"thesis_id": draft["id"], "thesis_version": 999},
        )
    history = repo.history(draft["id"])
    assert len(history["versions"]) == 1
    assert history["events"] == [] and history["selected_assessment"] is None


def test_summaries_report_the_newest_version_and_original_creation(tmp_path, thesis):
    repo = Repository(str(tmp_path / "library.sqlite3"))
    first = repo.create(thesis.model_dump(mode="json"))
    second = repo.create(thesis.model_dump(mode="json"))
    repo.evolve(first["id"], 1, {"confirmed": True}, {"action": "confirm"})

    summaries = {item["id"]: item for item in repo.summaries()}
    assert set(summaries) == {first["id"], second["id"]}

    evolved = summaries[first["id"]]
    assert evolved["version"] == 2 and evolved["confirmed"] is True
    assert evolved["assumption_count"] == 2
    assert evolved["instrument_id"] == "RNVDAUSDT"
    # The original creation survives an evolution; the new version dates the update.
    assert evolved["created_at"] == first["created_at"]
    assert evolved["updated_at"] > evolved["created_at"]
    # Nothing has been assessed yet, and an absent assessment stays absent.
    assert evolved["state"] is None and evolved["assessed_at"] is None

    assert summaries[second["id"]]["version"] == 1
    assert summaries[second["id"]]["confirmed"] is False


def test_summaries_are_empty_before_any_thesis_exists(tmp_path):
    assert Repository(str(tmp_path / "empty.sqlite3")).summaries() == []


def test_legacy_research_thread_foreign_key_is_repaired_without_data_loss(tmp_path, thesis):
    path = tmp_path / "legacy-thread.sqlite3"
    repo = Repository(str(path))
    draft = repo.create(thesis.model_dump(mode="json"))
    thread = {
        "thesis_id": draft["id"],
        "context_hash": "legacy-context",
        "messages": [],
    }
    repo.save_thread(thread)

    with sqlite3.connect(path) as connection:
        connection.executescript(
            """
            DELETE FROM schema_migrations WHERE version = 5;
            ALTER TABLE research_threads RENAME TO research_threads_current;
            CREATE TABLE research_threads (
                thesis_id TEXT NOT NULL,
                context_hash TEXT NOT NULL,
                body TEXT NOT NULL,
                PRIMARY KEY (thesis_id, context_hash),
                FOREIGN KEY (thesis_id) REFERENCES theses(id)
            );
            INSERT INTO research_threads SELECT * FROM research_threads_current;
            DROP TABLE research_threads_current;
            """
        )

    repaired = Repository(str(path))
    assert repaired.thread(draft["id"], "legacy-context") == thread
    repaired.save_thread({**thread, "messages": [{"role": "user", "content": "Why?"}]})

    with sqlite3.connect(path) as connection:
        assert connection.execute(
            "SELECT version FROM schema_migrations WHERE version = 5"
        ).fetchone() == (5,)
        assert connection.execute("PRAGMA foreign_key_list(research_threads)").fetchall() == []
