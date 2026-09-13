"""Assessment orchestration and neutral thesis revision comparison."""

import hashlib
import json
from datetime import datetime, timedelta

from backend.contracts import AssumptionResult, Evidence, State, StressInput, ThesisInput, utc_now
from backend.engines import stress

VERSIONS = {
    "model": "none-manual-confirmation",
    "prompt": "none",
    "engine": "decimal-v1",
    "policy": "confirmed-metric-floor-v1",
}


def digest(value: dict) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def evaluate(
    thesis: ThesisInput, evidence: list[Evidence], cutoff: datetime
) -> list[AssumptionResult]:
    results = []
    for assumption in thesis.assumptions:
        relevant = [
            item
            for item in evidence
            if item.available_at <= cutoff
            and (
                item.instrument_id == thesis.instrument_id
                or (item.instrument_id is None and thesis.instrument_id == "RNVDAUSDT")
            )
            and assumption.metric in item.metrics
            and cutoff - item.available_at <= timedelta(days=120)
        ]
        source = max(relevant, key=lambda item: item.available_at, default=None)
        if source is None:
            state, explanation, ids = (
                State.INSUFFICIENT,
                "No suitable current passage for this confirmed metric. Manual claims require research review.",
                [],
            )
        else:
            value = source.metrics[assumption.metric]
            state = State.INVALIDATED if value < assumption.minimum else State.SUPPORTED
            explanation = f"Reported {value}%; confirmed minimum {assumption.minimum}%. " + (
                "This satisfies the declared invalidation condition."
                if state == State.INVALIDATED
                else "The reported metric meets the condition for this period; future performance is unknown."
            )
            ids = [source.id]
        results.append(
            AssumptionResult(
                assumption_id=assumption.id,
                state=state,
                explanation=explanation,
                evidence_ids=ids,
                essential=assumption.essential,
            )
        )
    return results


def aggregate(results: list[AssumptionResult]) -> State:
    essential = {item.state for item in results if item.essential}
    for state in [State.INVALIDATED, State.CHALLENGED, State.INSUFFICIENT]:
        if state in essential:
            return state
    return State.SUPPORTED


def assessment(
    record: dict,
    evidence: list[Evidence],
    cutoff: datetime,
    scenario: StressInput,
    mode: str,
    disclosure_retrieval: dict | None = None,
) -> dict:
    thesis = ThesisInput.model_validate(record["thesis"])
    evidence = [
        item
        for item in evidence
        if item.available_at <= cutoff
        and (
            item.instrument_id == thesis.instrument_id
            or (item.instrument_id is None and thesis.instrument_id == "RNVDAUSDT")
        )
    ]
    results = evaluate(thesis, evidence, cutoff)
    numerical = stress(thesis, scenario)
    inputs = {
        "thesis_id": record["id"],
        "version": record["version"],
        "thesis": record["thesis"],
        "cutoff": cutoff.isoformat(),
        "mode": mode,
        "evidence": [item.model_dump(mode="json") for item in evidence],
        "scenario": scenario.model_dump(mode="json"),
        "versions": VERSIONS,
    }
    body = {
        "state": aggregate(results),
        "assumptions": [r.model_dump(mode="json") for r in results],
        "numerical": numerical,
        "missing": [
            "Compatible current share reference and unit ratio",
            "Narrative AI review has not been added to this assessment",
            "Token terms and current redemption availability",
        ],
        "next_question": "Does the latest primary disclosure still meet your essential metric floor?",
    }
    if disclosure_retrieval is not None:
        inputs["disclosure_retrieval"] = disclosure_retrieval
        body["disclosure_retrieval"] = disclosure_retrieval
        body["missing"].extend(disclosure_retrieval["warnings"])
    return {
        **body,
        "thesis_id": record["id"],
        "thesis_version": record["version"],
        "mode": mode,
        "evidence_cutoff": cutoff.isoformat(),
        "evaluated_at": utc_now().isoformat(),
        "evidence": inputs["evidence"],
        "versions": VERSIONS,
        "scenario": scenario.model_dump(mode="json"),
        "input_hash": digest(inputs),
        "result_hash": digest(body),
    }


def revision_changes(previous: ThesisInput, proposed: ThesisInput) -> list[str]:
    changes = []
    if previous.rationale != proposed.rationale:
        changes.append(
            "The rationale has changed. Review which original justification it replaces."
        )
    for field in ["holding_days", "max_loss", "max_slippage_bps", "proposed_amount", "entry_price"]:
        before, after = getattr(previous, field), getattr(proposed, field)
        if before != after:
            changes.append(f"{field.replace('_', ' ')}: {before} → {after}.")
    old = {item.id: item for item in previous.assumptions}
    new = {item.id: item for item in proposed.assumptions}
    for key in old.keys() | new.keys():
        if key not in new:
            changes.append(f"Removed original assumption: {old[key].claim}")
        elif key not in old:
            changes.append(f"Added assumption: {new[key].claim}")
        elif old[key] != new[key]:
            changes.append(
                f"Revised assumption {key}: {old[key].claim} → {new[key].claim}; minimum {old[key].minimum}% → {new[key].minimum}%."
            )
    return sorted(changes)
