import pytest

from backend.identity import LOCAL_USER_ID, OPERATOR_USER_ID
from backend.storage import Repository


def test_revision_and_reassessment_roll_back_together(tmp_path, thesis):
    repo = Repository(str(tmp_path / "atomic.sqlite3"))
    draft = repo.create(LOCAL_USER_ID, thesis.model_dump(mode="json"))
    with pytest.raises(ValueError, match="match"):
        repo.evolve(
            LOCAL_USER_ID,
            draft["id"],
            1,
            {"confirmed": True},
            {"action": "confirm"},
            reassessment={"thesis_id": draft["id"], "thesis_version": 999},
        )
    history = repo.history(LOCAL_USER_ID, draft["id"])
    assert len(history["versions"]) == 1
    assert history["events"] == [] and history["selected_assessment"] is None


def test_summaries_report_the_newest_version_and_original_creation(tmp_path, thesis):
    repo = Repository(str(tmp_path / "library.sqlite3"))
    first = repo.create(LOCAL_USER_ID, thesis.model_dump(mode="json"))
    second = repo.create(LOCAL_USER_ID, thesis.model_dump(mode="json"))
    repo.evolve(LOCAL_USER_ID, first["id"], 1, {"confirmed": True}, {"action": "confirm"})

    summaries = {item["id"]: item for item in repo.summaries(LOCAL_USER_ID)}
    assert set(summaries) == {first["id"], second["id"]}
    assert repo.summaries(OPERATOR_USER_ID) == []

    evolved = summaries[first["id"]]
    assert evolved["version"] == 2 and evolved["confirmed"] is True
    assert evolved["assumption_count"] == 2
    assert evolved["instrument_id"] == "RNVDAUSDT"
    assert evolved["created_at"] == first["created_at"]
    assert evolved["updated_at"] > evolved["created_at"]
    assert evolved["state"] is None and evolved["assessed_at"] is None

    assert summaries[second["id"]]["version"] == 1
    assert summaries[second["id"]]["confirmed"] is False


def test_summaries_are_empty_before_any_thesis_exists(tmp_path):
    assert Repository(str(tmp_path / "empty.sqlite3")).summaries(LOCAL_USER_ID) == []
