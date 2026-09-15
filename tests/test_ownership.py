from fastapi.testclient import TestClient

from backend.identity import OPERATOR_USER_ID
from backend.replay import DOCUMENTS
from backend.storage import Repository
from tests.auth_helpers import csrf_headers, sign_in, simulated_client
from tests.test_llm import FakeLanguageModel


def test_two_users_see_separate_libraries_and_404_on_foreign_records(tmp_path, monkeypatch, thesis):
    app = simulated_client(tmp_path, monkeypatch, llm=FakeLanguageModel())
    with TestClient(app) as alice, TestClient(app) as bob:
        alice_user = sign_in(alice, "alice")
        bob_user = sign_in(bob, "bob")
        assert alice_user["user_id"] != bob_user["user_id"]

        created = alice.post(
            "/theses/draft",
            json=thesis.model_dump(mode="json"),
            headers=csrf_headers(alice),
        )
        assert created.status_code == 201
        thesis_id = created.json()["id"]
        alice.post(
            f"/theses/{thesis_id}/confirm",
            json={**thesis.model_dump(mode="json"), "expected_version": 1},
            headers=csrf_headers(alice),
        )
        replay = alice.post(
            "/replays/nvidia-margin/step",
            json={"thesis_id": thesis_id, "expected_version": 2, "step": 0},
            headers=csrf_headers(alice),
        )
        assert replay.status_code == 200

        assert alice.get("/theses").json()[0]["id"] == thesis_id
        assert bob.get("/theses").json() == []
        assert bob.get(f"/theses/{thesis_id}").status_code == 404
        assert bob.get(f"/theses/{thesis_id}/assessments").status_code == 404
        assert (
            bob.get(
                f"/theses/{thesis_id}/conversation?assessment_input_hash={'a' * 64}"
            ).status_code
            == 404
        )
        assert bob.get(f"/theses/{thesis_id}/export").status_code == 404

        private_id = "alice-only-excerpt"
        repo: Repository = app.state.repository
        history = alice.get(f"/theses/{thesis_id}/assessments").json()
        selected = history["selected_assessment"]
        selected = {
            **selected,
            "input_hash": "d" * 64,
            "evidence": [
                {
                    **selected["evidence"][0],
                    "id": private_id,
                    "origin": "PUBLIC_RETRIEVAL",
                }
            ],
        }
        repo.assess(alice_user["user_id"], thesis_id, 2, selected)
        assert alice.get(f"/evidence/{private_id}").status_code == 200
        assert bob.get(f"/evidence/{private_id}").status_code == 404
        assert bob.get(f"/evidence/{DOCUMENTS[0].id}").status_code == 200

        operator = Repository(str(tmp_path / "auth.sqlite3"))
        assert operator.summaries(OPERATOR_USER_ID) == []


def test_identical_inputs_do_not_share_assessments_or_qwen_answers(tmp_path, monkeypatch, thesis):
    app = simulated_client(tmp_path, monkeypatch, llm=FakeLanguageModel(), name="dup.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        sign_in(alice, "alice")
        sign_in(bob, "bob")
        payload = thesis.model_dump(mode="json")
        alice_id = alice.post("/theses/draft", json=payload, headers=csrf_headers(alice)).json()[
            "id"
        ]
        bob_id = bob.post("/theses/draft", json=payload, headers=csrf_headers(bob)).json()["id"]
        for client, thesis_id in ((alice, alice_id), (bob, bob_id)):
            client.post(
                f"/theses/{thesis_id}/confirm",
                json={**payload, "expected_version": 1},
                headers=csrf_headers(client),
            )
            client.post(
                "/replays/nvidia-margin/step",
                json={"thesis_id": thesis_id, "expected_version": 2, "step": 0},
                headers=csrf_headers(client),
            )
        alice_hash = alice.get(f"/theses/{alice_id}/assessments").json()["selected_assessment"][
            "input_hash"
        ]
        bob_hash = bob.get(f"/theses/{bob_id}/assessments").json()["selected_assessment"][
            "input_hash"
        ]
        assert alice_hash != bob_hash
        alice_review = alice.post(
            f"/theses/{alice_id}/ai-review", headers=csrf_headers(alice)
        ).json()
        bob_review = bob.post(f"/theses/{bob_id}/ai-review", headers=csrf_headers(bob)).json()
        assert alice_review["narrative_review"]
        assert bob_review["narrative_review"]
        assert alice.get(f"/theses/{bob_id}/assessments").status_code == 404
