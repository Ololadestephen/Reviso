"""The live harness must refuse excess requests before network access."""

import json

import httpx
import pytest

from backend.llm import BITGET_QWEN_ENDPOINT, GROQ_ENDPOINT
from scripts import final_live_validation as validation
from scripts.final_live_validation import RequestBudget, freeze, run
from tests.test_llm import completion


def test_live_budget_counts_repairs_and_enforces_each_action_and_total(tmp_path):
    budget = RequestBudget(tmp_path)
    for name in ("draft", "mixed_review", "cited_followup"):
        budget.action = name
        budget.reserve(GROQ_ENDPOINT)
        budget.reserve(BITGET_QWEN_ENDPOINT)
        with pytest.raises(RuntimeError, match="ceiling"):
            budget.reserve(GROQ_ENDPOINT)
    budget.action = "unexpected_extra_action"
    with pytest.raises(RuntimeError, match="ceiling"):
        budget.reserve(GROQ_ENDPOINT)
    assert len(budget.attempts) == 6


def test_live_budget_rejects_other_endpoints(tmp_path):
    budget = RequestBudget(tmp_path)
    with pytest.raises(RuntimeError, match="endpoint"):
        budget.reserve("https://example.com/")
    assert not budget.attempts


def test_two_request_budget_cannot_be_bypassed_by_changing_actions(tmp_path):
    budget = RequestBudget(tmp_path, max_requests=2)
    budget.reserve(GROQ_ENDPOINT)
    budget.action = "repair"
    budget.reserve(GROQ_ENDPOINT)
    budget.action = "unapproved"
    with pytest.raises(RuntimeError, match="ceiling"):
        budget.reserve(GROQ_ENDPOINT)
    assert len(budget.attempts) == 2


def test_live_budget_rejects_invalid_ceiling(tmp_path):
    with pytest.raises(ValueError, match="ceiling"):
        RequestBudget(tmp_path, max_requests=7)


def test_freeze_is_exclusive_and_changed_manifest_cannot_call_provider(tmp_path):
    freeze(tmp_path)
    with pytest.raises(FileExistsError):
        freeze(tmp_path)
    (tmp_path / "manifest.json").write_text("{}")
    with pytest.raises(RuntimeError, match="Frozen"):
        run(tmp_path)
    assert not (tmp_path / "STARTED").exists()


def test_full_live_harness_uses_saved_api_flow_without_network(tmp_path, monkeypatch):
    calls = []

    def respond(request):
        body = json.loads(request.content)
        calls.append(body)
        if "instructions" in body:
            output = {
                "summary": "Margin missed the floor; revenue growth met it.",
                "items": [
                    {
                        "assumption_id": "margin",
                        "stance": "CONTRADICTS",
                        "evidence_ids": ["nvda-fy25-Third"],
                        "explanation": "74.6% is below 75%.",
                    },
                    {
                        "assumption_id": "growth",
                        "stance": "SUPPORTS",
                        "evidence_ids": ["nvda-fy25-Third"],
                        "explanation": "94% is above 80%.",
                    },
                ],
                "next_question": "What does the next filing show?",
            }
            return httpx.Response(200, json={"output_text": json.dumps(output)})
        schema = body["response_format"]["json_schema"]["name"]
        if schema.startswith("assumption_suggestion"):
            return completion(validation.THESIS)
        return completion(
            {
                "summary": {
                    "text": "The margin condition failed and growth held.",
                    "evidence_ids": ["nvda-fy25-Third"],
                },
                "facts": [
                    {"text": "Reported margin was 74.6%.", "evidence_ids": ["nvda-fy25-Third"]}
                ],
                "uncertainty": {"text": "The next quarter remains unknown.", "evidence_ids": []},
            }
        )

    real_groq, real_bitget = validation.ObservedGroq, validation.ObservedBitget

    def groq(key, **kwargs):
        return real_groq(key, client=httpx.Client(transport=httpx.MockTransport(respond)), **kwargs)

    def bitget(key):
        return real_bitget(key, client=httpx.Client(transport=httpx.MockTransport(respond)))

    monkeypatch.setattr(validation, "ObservedGroq", groq)
    monkeypatch.setattr(validation, "ObservedBitget", bitget)
    monkeypatch.setattr(validation, "load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("BITGET_QWEN_API_KEY", "test-only")
    monkeypatch.setenv("GROQ_API_KEY", "test-only")
    monkeypatch.setenv("REVISO_PUBLIC_DEMO", "0")
    monkeypatch.setenv("REVISO_SERVE_WEB", "0")
    monkeypatch.setenv("REVISO_AUTH_MODE", "google")
    freeze(tmp_path)
    run(tmp_path)
    results = json.loads((tmp_path / "results.json").read_text())
    assert [item["status"] for item in results] == ["PASS", "PASS", "PASS"]
    assert len(calls) == 3
    assert (tmp_path / "persistence.json").exists()
    with pytest.raises(FileExistsError):
        run(tmp_path)
    assert len(calls) == 3
