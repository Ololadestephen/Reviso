from fastapi.testclient import TestClient

from backend.api import create_app
from tests.test_llm import FakeLanguageModel


def test_export_is_saved_state_only_version_bounded_and_keeps_prior_assessment(tmp_path, thesis):
    path = str(tmp_path / "export.sqlite3")
    with TestClient(create_app(path, llm=FakeLanguageModel())) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        assessed = client.post(
            "/replays/nvidia-margin/step",
            json={"thesis_id": draft["id"], "expected_version": 2, "step": 0},
        ).json()
        client.post(
            base + "/questions",
            json={
                "question": "Which saved fact bears on this thesis?",
                "assessment_input_hash": assessed["input_hash"],
            },
        )
        kept = client.post(
            base + "/decisions",
            json={
                "expected_version": 2,
                "action": "retain",
                "explanation": "The saved evidence still supports continued research.",
            },
        )
        assert kept.status_code == 200 and kept.json()["version"] == 3

        current = client.get(base + "/export?format=json&version=3")
        assert current.status_code == 200
        assert "reviso-nvda-v3.json" in current.headers["content-disposition"]
        snapshot = current.json()
        assert snapshot["thesis"]["version"] == 3
        assert snapshot["selected_assessment"]["input_hash"] == assessed["input_hash"]
        assert len(snapshot["research_answers"]) == 1
        assert snapshot["decision_events"][-1]["action"] == "retain"

        original = client.get(base + "/export?format=json&version=1").json()
        assert original["thesis"]["version"] == 1
        assert original["selected_assessment"] is None
        assert original["research_answers"] == []
        assert original["decision_events"] == []

        markdown = client.get(base + "/export?format=markdown&version=3")
        assert markdown.status_code == 200
        assert "# Reviso research · NVIDIA" in markdown.text
        assert "## Cited follow-up answers" in markdown.text
        assert "no trade was placed" in markdown.text.lower()
        assert "BITGET_QWEN_API_KEY" not in markdown.text


def test_unknown_export_version_is_not_found(tmp_path, thesis):
    with TestClient(create_app(str(tmp_path / "missing-version.sqlite3"))) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        response = client.get(f"/theses/{draft['id']}/export?version=99")
        assert response.status_code == 404
