import json
import runpy
from pathlib import Path

from backend.llm import BitgetQwenLanguageModel

HARNESS = runpy.run_path(str(Path(__file__).with_name("evaluation_batch.py")))


def test_evaluation_harness_is_bounded_and_checks_isolated_persistence(tmp_path, monkeypatch):
    def response(model, endpoint, body):
        case = model.case
        if case["kind"] == "extract":
            output = case["thesis"]
        else:
            output = {
                "summary": "Evaluation fixture supplies the relevant evidence.",
                "next_question": "What will the next report show?",
                "items": [
                    {
                        "assumption_id": identifier,
                        "stance": accepted[0],
                        "explanation": "The supplied fixture supports this classification.",
                        "evidence_ids": [case["evidence"][-1]["id"]],
                    }
                    for identifier, accepted in case["expected"].items()
                ],
            }
        return {"output_text": json.dumps(output), "usage": {"total_tokens": 1}}

    monkeypatch.setattr(BitgetQwenLanguageModel, "_post", response)
    directory = tmp_path / "evaluation"
    HARNESS["prepare"](directory)
    corpus = json.loads((directory / "corpus.json").read_text())
    budget = [0]
    results = [
        HARNESS["evaluate"](directory, case, "fixture-key", budget, corpus["request_cap"])
        for case in corpus["cases"]
    ]
    assert len(results) == 21
    assert all(result["status"] == "PASS" for result in results), results
    assert budget[0] == 21
    assert results[-1]["checks"]["survives_restart"]
    assert results[-1]["checks"]["cached_without_provider_call"]
    budget[0] = 42
    denied = HARNESS["evaluate"](
        directory, corpus["cases"][4], "fixture-key", budget, corpus["request_cap"]
    )
    assert denied["status"] == "ERROR"
    assert budget[0] == 42
    assert denied["requests"] == 0


def test_v2_holdout_is_five_cases_with_a_ten_request_cap(tmp_path, monkeypatch):
    def response(model, endpoint, body):
        case = model.case
        if case["kind"] == "extract":
            output = case["thesis"]
        else:
            output = {
                "summary": "The supplied evidence determines these classifications.",
                "next_question": "What will the next report show?",
                "items": [
                    {
                        "assumption_id": identifier,
                        "stance": accepted[0],
                        "explanation": "The supplied passage supports this classification.",
                        "evidence_ids": [case["evidence"][-1]["id"]],
                    }
                    for identifier, accepted in case["expected"].items()
                ],
            }
        return {"output_text": json.dumps(output), "usage": {"total_tokens": 1}}

    monkeypatch.setattr(BitgetQwenLanguageModel, "_post", response)
    directory = tmp_path / "v2-holdout"
    HARNESS["prepare_holdout"](directory)
    corpus = json.loads((directory / "corpus.json").read_text())
    manifest = json.loads((directory / "manifest.json").read_text())

    assert corpus["version"] == "reviso-v2-validation-holdout-01"
    assert corpus["request_cap"] == 10
    assert len(corpus["cases"]) == manifest["case_count"] == 5

    budget = [0]
    results = [
        HARNESS["evaluate"](directory, case, "fixture-key", budget, corpus["request_cap"])
        for case in corpus["cases"]
    ]
    assert all(result["status"] == "PASS" for result in results), results
    assert budget[0] == 5
    assert results[-1]["checks"]["survives_restart"]
    assert results[-1]["checks"]["cached_without_provider_call"]

    budget[0] = 10
    denied = HARNESS["evaluate"](
        directory, corpus["cases"][1], "fixture-key", budget, corpus["request_cap"]
    )
    assert denied["status"] == "ERROR"
    assert budget[0] == 10
    assert denied["requests"] == 0
