"""Offline evidence-boundary checks; not a model-accuracy benchmark."""

import json
from datetime import timedelta

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.contracts import Assumption, State, StressInput, ThesisIdeaInput
from backend.llm import GroqLanguageModel, LLMInvalidOutputError
from backend.replay import CUTOFFS, available_evidence
from backend.research_context import ResearchContext
from backend.services import assessment, narrative_context_hash
from tests.test_llm import FakeLanguageModel, completion, valid_review


def saved_check(thesis, cutoff=CUTOFFS[1]):
    return assessment(
        {"id": "quality", "version": 2, "thesis": thesis.model_dump(mode="json")},
        available_evidence(CUTOFFS[1]),
        cutoff,
        StressInput(),
        "HISTORICAL_REPLAY",
    )


def test_same_filing_with_new_missing_states_cannot_reuse_an_old_explanation(thesis):
    current = saved_check(thesis)
    stale = saved_check(thesis, CUTOFFS[1] + timedelta(days=121))
    evidence = available_evidence(CUTOFFS[1])
    assert current["state"] == "INVALIDATED"
    assert stale["state"] == "INSUFFICIENT_EVIDENCE"
    assert narrative_context_hash(thesis, evidence, ResearchContext.from_assessment(current)) != (
        narrative_context_hash(thesis, evidence, ResearchContext.from_assessment(stale))
    )
    timestamp_only = {**current, "evidence_cutoff": (CUTOFFS[1] + timedelta(hours=1)).isoformat()}
    assert narrative_context_hash(thesis, evidence, ResearchContext.from_assessment(current)) == (
        narrative_context_hash(thesis, evidence, ResearchContext.from_assessment(timestamp_only))
    )


@pytest.mark.parametrize("missing_citation", [False, True])
def test_numeric_review_repairs_reversal_or_uncited_claim_with_original_context(
    thesis, missing_citation
):
    evidence = available_evidence(CUTOFFS[1])
    finding = ResearchContext.from_assessment(saved_check(thesis))
    correct = valid_review(thesis, evidence[-1].id)
    correct["items"][0]["stance"] = "CONTRADICTS"
    wrong = json.loads(json.dumps(correct))
    wrong["items"][0]["stance"] = "SUPPORTS"
    if missing_citation:
        wrong = json.loads(json.dumps(correct))
        wrong["items"][0]["evidence_ids"] = []
    requests = []

    def respond(request):
        requests.append(json.loads(request.content))
        return completion(wrong if len(requests) == 1 else correct)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        model = GroqLanguageModel("test-only", client=client)
        result = model.review(thesis, evidence, finding=finding)
    assert result.items[0].stance == "CONTRADICTS"
    assert len(requests) == 2
    for request in requests:
        payload = json.loads(request["messages"][1]["content"])
        assert payload["saved_finding"]["conditions"][0]["state"] == "INVALIDATED"
        assert "74.6%" in payload["saved_finding"]["conditions"][0]["explanation"]
        assert payload["saved_finding"]["mode"] == "HISTORICAL_REPLAY"
        assert payload["allowlisted_evidence"][-1]["reported_metrics"]["gaap_margin_pct"] == "74.6"


def test_stale_metric_cannot_be_supported_and_manual_review_is_separate(thesis):
    thesis.assumptions.append(
        Assumption(
            id="demand",
            claim="Demand remains healthy",
            metric="manual",
            minimum="0",
            invalidation_condition="Requires manual evidence review; no numerical invalidation rule.",
        )
    )
    evidence = available_evidence(CUTOFFS[1])
    finding = ResearchContext.from_assessment(saved_check(thesis, CUTOFFS[1] + timedelta(days=121)))
    review = valid_review(thesis, evidence[-1].id)
    review["items"][0]["stance"] = "INSUFFICIENT_EVIDENCE"
    review["items"][0]["evidence_ids"] = []
    review["items"][1]["stance"] = "INSUFFICIENT_EVIDENCE"
    review["items"][1]["evidence_ids"] = []
    result = GroqLanguageModel._validated_review(review, thesis, evidence, finding)
    assert result.items[-1].stance == "SUPPORTS"  # Narrative claims do not fill numerical gaps.
    review["items"][0]["stance"] = "SUPPORTS"
    review["items"][0]["evidence_ids"] = [evidence[-1].id]
    with pytest.raises(LLMInvalidOutputError, match="reversed"):
        GroqLanguageModel._validated_review(review, thesis, evidence, finding)


@pytest.mark.parametrize("has_facts", [False, True])
def test_abstention_can_be_uncited_but_reported_facts_need_a_source(thesis, has_facts):
    evidence = available_evidence(CUTOFFS[1])
    answer = {
        "summary": "This filing does not answer the question about future demand.",
        "facts": ["A reported fact without a citation."] if has_facts else [],
        "uncertainty": "Future demand cannot be established from this filing.",
        "evidence_ids": [],
    }
    calls = []

    def respond(request):
        calls.append(json.loads(request.content))
        return completion(answer)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        model = GroqLanguageModel("test-only", client=client)
        finding = ResearchContext.from_assessment(saved_check(thesis))
        if has_facts:
            with pytest.raises(LLMInvalidOutputError, match="local validation"):
                model.answer(thesis, evidence, "Will demand increase?", finding=finding)
            assert len(calls) == 2
        else:
            assert (
                model.answer(thesis, evidence, "Will demand increase?", finding=finding).facts == []
            )
            assert len(calls) == 1
        for call in calls:
            payload = json.loads(call["messages"][1]["content"])
            assert payload["saved_finding"]["state"] == "INVALIDATED"


def test_drafting_repairs_an_issuer_unsupported_metric():
    idea = ThesisIdeaInput(
        instrument_id="RGOOGLUSDT", rationale="Alphabet's advertising demand stays healthy."
    )
    unsupported = {
        "rationale": idea.rationale,
        "assumptions": [
            {
                "id": "margin",
                "claim": "Margin stays healthy",
                "metric": "gaap_margin_pct",
                "minimum": "75",
                "invalidation_condition": "noncanonical",
            }
        ],
    }
    corrected = {
        "rationale": idea.rationale,
        "assumptions": [
            {
                "id": "demand",
                "claim": "Advertising demand stays healthy",
                "metric": "manual",
                "minimum": "0",
                "invalidation_condition": "noncanonical",
            }
        ],
    }
    calls = []

    def respond(request):
        calls.append(json.loads(request.content))
        return completion(unsupported if len(calls) == 1 else corrected)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        result = GroqLanguageModel("test-only", client=client).suggest(idea)
    assert result.assumptions[0].metric == "manual"
    assert len(calls) == 2
    for call in calls:
        payload = json.loads(call["messages"][1]["content"])
        assert "gaap_margin_pct" not in payload["supported_metrics"]
        assert payload["idea_as_untrusted_data"] == idea.rationale


def test_review_and_both_question_endpoints_receive_the_exact_saved_comparisons(tmp_path, thesis):
    model = FakeLanguageModel()
    with TestClient(create_app(str(tmp_path / "context.sqlite3"), llm=model)) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        selected = client.post(
            "/replays/nvidia-margin/step",
            json={
                "thesis_id": draft["id"],
                "expected_version": 2,
                "step": 1,
            },
        ).json()
        reviewed = client.post(base + "/ai-review").json()
        assert model.last_finding.state == State.INVALIDATED
        assert model.last_finding.conditions[0].state == State.INVALIDATED
        assert model.last_finding.conditions[1].state == State.SUPPORTED
        for endpoint in ["questions", "conversation"]:
            response = client.post(
                base + "/" + endpoint,
                json={
                    "assessment_input_hash": reviewed["input_hash"],
                    "question": "Which condition did not hold?",
                },
            )
            assert response.status_code == 200
            assert model.last_finding.evidence_cutoff == selected["evidence_cutoff"]
            assert (
                model.last_finding.conditions[0].evidence_ids
                == selected["assumptions"][0]["evidence_ids"]
            )
