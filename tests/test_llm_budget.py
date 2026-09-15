import threading

from fastapi.testclient import TestClient

from backend.api import create_app
from backend.contracts import NarrativeReview
from backend.identity import LOCAL_USER_ID
from backend.llm_budget import DuplicateLlmRequest, LlmAllowanceExceeded, note_provider_request
from backend.storage import LlmLimits, Repository
from tests.auth_helpers import csrf_headers, sign_in, simulated_client
from tests.test_llm import FakeLanguageModel, valid_review


class RepairingLanguageModel(FakeLanguageModel):
    def review(self, thesis, evidence):
        note_provider_request()
        note_provider_request()
        return NarrativeReview.model_validate(valid_review(thesis, evidence[-1].id))


def _confirmed_replay(client, thesis):
    payload = thesis.model_dump(mode="json")
    thesis_id = client.post("/theses/draft", json=payload, headers=csrf_headers(client)).json()[
        "id"
    ]
    client.post(
        f"/theses/{thesis_id}/confirm",
        json={**payload, "expected_version": 1},
        headers=csrf_headers(client),
    )
    assessed = client.post(
        "/replays/nvidia-margin/step",
        json={"thesis_id": thesis_id, "expected_version": 2, "step": 0},
        headers=csrf_headers(client),
    )
    assert assessed.status_code == 200
    return thesis_id, assessed.json()


def test_repair_attempts_count_toward_the_user_and_total_budget(tmp_path, monkeypatch, thesis):
    monkeypatch.setenv("REVISO_AUTH_MODE", "simulated")
    monkeypatch.setenv("REVISO_QWEN_USER_DAILY_LIMIT", "2")
    monkeypatch.setenv("REVISO_QWEN_TOTAL_DAILY_LIMIT", "2")
    app = create_app(str(tmp_path / "budget.sqlite3"), llm=RepairingLanguageModel())
    with TestClient(app) as client:
        sign_in(client, "alice")
        thesis_id, _assessed = _confirmed_replay(client, thesis)
        review = client.post(f"/theses/{thesis_id}/ai-review", headers=csrf_headers(client))
        assert review.status_code == 200
        blocked = client.post(
            "/theses/extract",
            json={"current": thesis.model_dump(mode="json")},
            headers=csrf_headers(client),
        )
        assert blocked.status_code == 429
        saved = client.get(f"/theses/{thesis_id}/assessments")
        assert saved.status_code == 200
        assert saved.json()["selected_assessment"]["narrative_review"]
        selected = saved.json()["selected_assessment"]
        conversation = client.get(
            f"/theses/{thesis_id}/conversation?assessment_input_hash={selected['input_hash']}"
        )
        assert conversation.status_code == 200


def test_total_budget_blocks_a_second_account(tmp_path, monkeypatch, thesis):
    monkeypatch.setenv("REVISO_QWEN_USER_DAILY_LIMIT", "5")
    monkeypatch.setenv("REVISO_QWEN_TOTAL_DAILY_LIMIT", "1")
    app = simulated_client(tmp_path, monkeypatch, llm=FakeLanguageModel(), name="total.sqlite3")
    with TestClient(app) as alice, TestClient(app) as bob:
        sign_in(alice, "alice")
        sign_in(bob, "bob")
        alice_id, _assessed = _confirmed_replay(alice, thesis)
        assert (
            alice.post(f"/theses/{alice_id}/ai-review", headers=csrf_headers(alice)).status_code
            == 200
        )
        bob_id, _ = _confirmed_replay(bob, thesis)
        blocked = bob.post(f"/theses/{bob_id}/ai-review", headers=csrf_headers(bob))
        assert blocked.status_code == 429
        assert bob.get(f"/theses/{bob_id}/assessments").status_code == 200


def test_concurrent_allowance_and_duplicate_inflight(tmp_path):
    repo = Repository(str(tmp_path / "slots.sqlite3"))
    limits = LlmLimits(user_daily=1, total_daily=10, max_concurrent_user=4, max_concurrent_total=8)
    repo.acquire_llm_slot(LOCAL_USER_ID, "same-key", limits)
    try:
        try:
            repo.acquire_llm_slot(LOCAL_USER_ID, "same-key", limits)
            raise AssertionError("duplicate inflight should fail")
        except DuplicateLlmRequest:
            pass
    finally:
        repo.release_llm_slot(LOCAL_USER_ID, "same-key")

    scopes: list[str] = []

    def worker(key: str) -> None:
        try:
            repo.acquire_llm_slot(LOCAL_USER_ID, key, limits)
            repo.consume_llm_allowance(LOCAL_USER_ID, 1, limits)
        except LlmAllowanceExceeded as error:
            scopes.append(error.scope)
        finally:
            repo.release_llm_slot(LOCAL_USER_ID, key)

    threads = [threading.Thread(target=worker, args=(f"k{index}",)) for index in range(2)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    assert scopes == ["user"] or scopes.count("user") == 1
