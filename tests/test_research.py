from datetime import timedelta

import pytest
from pydantic import ValidationError

from backend.contracts import Assumption, State, StressInput
from backend.replay import CUTOFFS, DOCUMENTS, available_evidence
from backend.services import aggregate, assessment, evaluate, revision_changes


def test_future_evidence_excluded(thesis):
    assert available_evidence(CUTOFFS[0] - timedelta(seconds=1)) == []
    result = evaluate(thesis, DOCUMENTS, CUTOFFS[0])
    assert aggregate(result) == State.SUPPORTED
    assert all(item.evidence_ids == [DOCUMENTS[0].id] for item in result)


def test_margin_breach_with_growth_negative_control(thesis):
    results = evaluate(thesis, DOCUMENTS, CUTOFFS[1])
    assert results[0].state == State.INVALIDATED
    assert results[1].state == State.SUPPORTED
    assert aggregate(results) == State.INVALIDATED
    thesis.assumptions[0].essential = False
    assert aggregate(evaluate(thesis, DOCUMENTS, CUTOFFS[1])) == State.SUPPORTED


def test_missing_stale_and_duplicate_evidence(thesis):
    assert aggregate(evaluate(thesis, [], CUTOFFS[1])) == State.INSUFFICIENT
    assert (
        aggregate(evaluate(thesis, DOCUMENTS, CUTOFFS[1] + timedelta(days=121)))
        == State.INSUFFICIENT
    )
    assert evaluate(thesis, DOCUMENTS * 3, CUTOFFS[1]) == evaluate(thesis, DOCUMENTS, CUTOFFS[1])


def test_assessment_determinism_and_neutral_revision(thesis):
    record = {"id": "test", "version": 2, "thesis": thesis.model_dump(mode="json")}
    a = assessment(record, DOCUMENTS, CUTOFFS[1], StressInput(), "HISTORICAL_REPLAY")
    b = assessment(record, DOCUMENTS, CUTOFFS[1], StressInput(), "HISTORICAL_REPLAY")
    assert a["input_hash"] == b["input_hash"] and a["result_hash"] == b["result_hash"]
    new = thesis.model_copy(deep=True)
    new.holding_days = 180
    new.rationale = "A valuation argument now supports the proposed trade."
    changes = revision_changes(thesis, new)
    assert any("90 → 180" in change for change in changes)
    assert any("rationale has changed" in change for change in changes)


def test_manual_assumptions_use_an_explicit_non_numerical_condition():
    with pytest.raises(ValidationError, match="explicit manual-review condition"):
        Assumption(
            id="manual",
            claim="A qualitative catalyst remains intact.",
            metric="manual",
            minimum="0",
            invalidation_condition="Trust the model's judgment.",
        )
