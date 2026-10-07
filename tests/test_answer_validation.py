"""Offline attribution regressions; no provider credentials or network calls."""

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.answer_validation import validated_answer
from backend.api import create_app
from backend.contracts import Evidence, ThesisInput
from backend.llm import (
    QUESTION_PROMPT_VERSION,
    GroqLanguageModel,
    LLMInvalidOutputError,
    UnavailableLanguageModel,
)
from backend.replay import CUTOFFS, available_evidence
from tests.test_llm import FakeLanguageModel, completion


def statement(text, ids=()):
    return {"text": text, "evidence_ids": list(ids)}


def candidate(source_id):
    return {
        "summary": statement("The supplied report is limited.", [source_id]),
        "facts": [statement("The excerpt contains company commentary.", [source_id])],
        "uncertainty": statement("A peer comparison is still missing."),
    }


@pytest.fixture
def frozen_company_answer():
    folder = Path(__file__).resolve().parents[1] / "docs/evaluations/official-ai-2026-10-04"
    packet = json.loads((folder / "packet.json").read_text())
    results = json.loads((folder / "results.json").read_text())
    turn = next(item for item in results if item["action"] == "company_followup")
    saved = turn["output"]["messages"][-1]["answer"]
    # Adapt the frozen flat response to the new provider-only shape, without
    # changing its text or citations. Raw live artifacts stay immutable.
    raw = {
        "summary": statement(saved["summary"], saved["evidence_ids"]),
        "facts": [statement(text, saved["evidence_ids"]) for text in saved["facts"]],
        "uncertainty": statement(saved["uncertainty"]),
    }
    evidence = [Evidence.model_validate(item) for item in packet["financial"]["evidence"]] + [
        Evidence.model_validate(item) for item in packet["research"]["sources"]
    ]
    return raw, evidence, ThesisInput.model_validate(packet["thesis"])


def test_frozen_live_defect_fails_even_with_longer_reply_allowance(frozen_company_answer):
    raw, evidence, thesis = frozen_company_answer
    with pytest.raises(ValueError, match="percentage.*cited sources"):
        validated_answer(raw, evidence, thesis, detail=True)


def test_summary_cannot_borrow_a_facts_citation(frozen_company_answer):
    raw, evidence, thesis = frozen_company_answer
    raw["facts"][0]["evidence_ids"].append(evidence[0].id)
    with pytest.raises(ValueError, match="percentage.*cited sources"):
        validated_answer(raw, evidence, thesis, detail=True)


def test_correctly_attributed_summary_and_facts_keep_public_shape(frozen_company_answer):
    raw, evidence, thesis = frozen_company_answer
    raw["summary"] = statement(
        "Revenue growth was 106%, below your minimum 120%. Margin was 75.0%.",
        [evidence[0].id],
    )
    result = validated_answer(raw, evidence, thesis, detail=False)
    assert result.evidence_ids == [evidence[0].id, raw["facts"][0]["evidence_ids"][0]]
    assert result.summary == raw["summary"]["text"]
    assert result.facts == [item["text"] for item in raw["facts"]]
    assert set(result.model_dump()) == {"summary", "facts", "uncertainty", "evidence_ids"}


@pytest.mark.parametrize("location", ["summary", "fact", "uncertainty"])
def test_phantom_ids_fail_in_every_response_field(thesis, location):
    evidence = available_evidence(CUTOFFS[0])
    raw = candidate(evidence[0].id)
    target = raw["facts"][0] if location == "fact" else raw[location]
    target["evidence_ids"] = ["phantom"]
    with pytest.raises(ValueError, match="outside the selected set"):
        validated_answer(raw, evidence, thesis, False)


@pytest.mark.parametrize("location", ["summary", "fact"])
def test_each_statement_requires_its_own_citation(thesis, location):
    evidence = available_evidence(CUTOFFS[0])
    raw = candidate(evidence[0].id)
    target = raw["facts"][0] if location == "fact" else raw[location]
    target["evidence_ids"] = []
    with pytest.raises(ValueError, match="identify their sources"):
        validated_answer(raw, evidence, thesis, False)


@pytest.mark.parametrize("notation", ["999%", "999 percent", "999 per cent", "1,106%"])
def test_unknown_numbers_in_uncertainty_are_not_a_citation_escape(thesis, notation):
    evidence = available_evidence(CUTOFFS[0])
    raw = candidate(evidence[0].id)
    raw["uncertainty"] = statement(f"The report says {notation} is likely.")
    with pytest.raises(ValueError, match="percentage.*cited sources"):
        validated_answer(raw, evidence, thesis, False)


def test_only_the_supplied_excerpt_can_support_a_percentage(thesis):
    source = available_evidence(CUTOFFS[0])[0].model_copy(
        update={"excerpt": "Commentary " * 100 + "999 percent", "metrics": {}}
    )
    raw = candidate(source.id)
    raw["summary"] = statement("The report says 999 percent.", [source.id])
    with pytest.raises(ValueError, match="percentage.*cited sources"):
        validated_answer(raw, [source], thesis, False)


@pytest.mark.parametrize("notation", ["1,,06%", "10,6%"])
def test_malformed_digit_grouping_is_not_normalized_into_a_known_metric(thesis, notation):
    evidence = available_evidence(CUTOFFS[0])
    raw = candidate(evidence[0].id)
    raw["summary"] = statement(f"Reported growth was {notation}.", [evidence[0].id])
    with pytest.raises(ValueError, match="malformed digit grouping"):
        validated_answer(raw, evidence, thesis, False)


def test_complete_reply_not_only_summary_has_a_word_limit(thesis):
    evidence = available_evidence(CUTOFFS[0])
    raw = candidate(evidence[0].id)
    raw["summary"]["text"] = "word " * 60
    raw["facts"][0]["text"] = "word " * 10
    raw["uncertainty"]["text"] = "word " * 10
    with pytest.raises(ValueError, match="complete answer exceeds 70"):
        validated_answer(raw, evidence, thesis, False)
    assert validated_answer(raw, evidence, thesis, True)
    raw["summary"]["text"] = "word " * 141
    with pytest.raises(ValueError, match="complete answer exceeds 160"):
        validated_answer(raw, evidence, thesis, True)


def test_source_free_abstention_remains_possible(thesis):
    raw = {
        "summary": statement("No supplied report can answer this question."),
        "facts": [],
        "uncertainty": statement("Company demand remains unknown."),
    }
    assert validated_answer(raw, [], thesis, False).evidence_ids == []
    raw["facts"] = [statement("Company demand is strong.")]
    with pytest.raises(ValueError, match="without evidence"):
        validated_answer(raw, [], thesis, False)


@pytest.mark.parametrize("repair_succeeds", [True, False])
def test_one_repair_retains_context_length_and_attribution_rules(thesis, repair_succeeds):
    evidence = available_evidence(CUTOFFS[0])
    invalid = candidate(evidence[0].id)
    invalid["summary"] = statement("The report says 999% growth.", [evidence[0].id])
    calls = []

    def respond(request):
        calls.append(json.loads(request.content))
        return completion(
            candidate(evidence[0].id) if repair_succeeds and len(calls) == 2 else invalid
        )

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        model = GroqLanguageModel("test-only", client=client)
        if repair_succeeds:
            assert model.answer(thesis, evidence, "What does the report say?")
        else:
            with pytest.raises(LLMInvalidOutputError, match="local validation"):
                model.answer(thesis, evidence, "What does the report say?")
    assert len(calls) == 2
    payloads = [json.loads(item["messages"][1]["content"]) for item in calls]
    assert payloads[1]["allowlisted_evidence"] == payloads[0]["allowlisted_evidence"]
    assert payloads[1]["confirmed_assumptions"] == payloads[0]["confirmed_assumptions"]
    assert "70 words in TOTAL" in payloads[1]["task"]
    assert "summary AND each fact" in payloads[1]["task"]
    assert "percentage" in payloads[1]["validation_error"]


def test_old_prompt_answer_does_not_short_circuit_a_new_question_version(tmp_path, thesis):
    model = FakeLanguageModel()
    app = create_app(str(tmp_path / "cache.sqlite3"), llm=model)
    with TestClient(app) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        check = client.post(
            "/replays/nvidia-margin/step",
            json={"thesis_id": draft["id"], "expected_version": 2, "step": 0},
        ).json()
        body = {
            "question": "What does this report say?",
            "assessment_input_hash": check["input_hash"],
        }
        first = client.post(base + "/conversation", json=body).json()
        owner = client.get("/auth/me").json()["user_id"]
        repo = app.state.repository
        old = repo.research_answers(owner, draft["id"])[0]
        old["llm_provenance"]["prompt_version"] = "research-question-v4"
        # Simulate an old stored answer without rewriting any live notebook.
        with repo.connect() as connection:
            connection.execute(
                "UPDATE research_answers SET body=? WHERE id=?", (json.dumps(old), old["id"])
            )
        second = client.post(base + "/conversation", json=body)
        assert second.status_code == 200
        assert model.answer_calls == 2
        assert second.json()["messages"][: len(first["messages"])] == first["messages"]
        newest = repo.research_answers(owner, draft["id"])[-1]
        assert newest["llm_provenance"]["prompt_version"] == QUESTION_PROMPT_VERSION
        assert repo.research_answer_by_id("someone-else", draft["id"], newest["id"]) is None
        assert repo.research_answer_by_id(owner, "another-thesis", newest["id"]) is None
        assert client.post(base + "/conversation", json=body).json() == second.json()
        assert model.answer_calls == 2


@pytest.mark.parametrize("valid", [True, False])
def test_validated_chat_persists_or_fails_without_saving_bad_output(tmp_path, thesis, valid):
    path = str(tmp_path / "persistence.sqlite3")
    calls = []

    def respond(request):
        payload = json.loads(json.loads(request.content)["messages"][1]["content"])
        calls.append(payload)
        source_id = payload["allowlisted_evidence"][0]["id"]
        raw = candidate(source_id)
        if not valid:
            raw["summary"] = statement("The report says 999% growth.", [source_id])
        return completion(raw)

    with httpx.Client(transport=httpx.MockTransport(respond)) as transport:
        chat = GroqLanguageModel("test-only", client=transport)
        app = create_app(path, llm=FakeLanguageModel(), chat_llm=chat)
        with TestClient(app) as client:
            draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
            base = f"/theses/{draft['id']}"
            client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
            check = client.post(
                "/replays/nvidia-margin/step",
                json={"thesis_id": draft["id"], "expected_version": 2, "step": 0},
            ).json()
            body = {
                "question": "What does the report say?",
                "assessment_input_hash": check["input_hash"],
            }
            response = client.post(base + "/conversation", json=body)
            owner = client.get("/auth/me").json()["user_id"]
            if valid:
                assert response.status_code == 200, response.text
                assert client.post(base + "/conversation", json=body).json() == response.json()
                assert len(calls) == 1
                expected = response.json()
                assert expected["messages"][-1]["evidence_ids"] == [check["evidence"][0]["id"]]
                exported = client.get(base + "/export?format=json").json()["research_answers"]
                assert exported[-1]["answer"] == expected["messages"][-1]["answer"]
            else:
                assert response.status_code == 502
                assert len(calls) == 2
                assert client.get(base + "/questions").json() == []
                thread = client.get(
                    base + "/conversation", params={"assessment_input_hash": check["input_hash"]}
                )
                assert thread.json()["messages"] == []
            assert app.state.repository.llm_usage(owner)["user"] == len(calls)
    if valid:
        with TestClient(create_app(path, llm=UnavailableLanguageModel())) as reopened:
            thread = reopened.get(
                base + "/conversation", params={"assessment_input_hash": check["input_hash"]}
            )
            assert thread.json() == expected
            assert reopened.get(base + "/export?format=json").json()["research_answers"] == exported
