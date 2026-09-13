"""One-shot live validation for the frozen multi-stock newcomer corpus.

Freeze: PYTHONPATH=. uv run python scripts/newcomer_live_validation.py freeze DIRECTORY
Run:    PYTHONPATH=. uv run python scripts/newcomer_live_validation.py run DIRECTORY

The run command consumes Bitget Qwen credit. It refuses to rerun a started
directory and enforces both a two-request case ceiling and the corpus ceiling.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.company_disclosures import CompanyDisclosureProvider
from backend.contracts import (
    Evidence,
    ResearchAnswer,
    SavedResearchAnswer,
    StressInput,
    ThesisIdeaInput,
    ThesisInput,
    ThesisSuggestion,
    utc_now,
)
from backend.instruments import INSTRUMENTS
from backend.llm import (
    BITGET_QWEN_ENDPOINT,
    BitgetQwenLanguageModel,
    LLMInvalidOutputError,
    LLMUnavailableError,
    UnavailableLanguageModel,
)
from backend.providers import BitgetProvider
from backend.services import assessment

ROOT = Path(__file__).resolve().parents[1]
CASE_REQUEST_CAP = 2
ABSOLUTE_REQUEST_CAP = 10
HASHED_SOURCES = (
    "backend/contracts.py",
    "backend/instruments.py",
    "backend/llm.py",
    "backend/routes.py",
    "backend/services.py",
    "backend/storage.py",
    "scripts/newcomer_live_validation.py",
)


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n")


def digest_json(value: Any) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def freeze(directory: Path) -> None:
    corpus_path = directory / "corpus.json"
    corpus = json.loads(corpus_path.read_text())
    if (directory / "STARTED").exists():
        raise RuntimeError("Cannot freeze a started batch")
    request_cap = corpus.get("request_cap")
    if request_cap != ABSOLUTE_REQUEST_CAP or len(corpus.get("cases", [])) != 5:
        raise RuntimeError("Unexpected frozen corpus shape")
    manifest_path = directory / "manifest.json"
    with manifest_path.open("x") as handle:
        json.dump(
            {
                "corpus_sha256": digest_json(corpus),
                "case_count": len(corpus["cases"]),
                "request_cap": request_cap,
                "source_sha256": {name: file_digest(ROOT / name) for name in HASHED_SOURCES},
                "frozen_at": datetime.now(UTC).isoformat(),
            },
            handle,
            indent=2,
        )
        handle.write("\n")
    print(json.dumps({"frozen": str(directory), "cases": 5, "request_cap": 10}))


class ObservedBitgetQwen(BitgetQwenLanguageModel):
    """Record safe request metadata while enforcing hard provider-call limits."""

    def __init__(
        self,
        key: str,
        directory: Path,
        case_id: str,
        budget: list[int],
        request_cap: int,
    ):
        super().__init__(key)
        self.directory = directory
        self.case_id = case_id
        self.budget = budget
        self.request_cap = request_cap
        self.attempts: list[dict[str, Any]] = []

    @property
    def artifact_path(self) -> Path:
        return self.directory / f"{self.case_id}-requests.json"

    def _post(self, endpoint: str, body: dict) -> dict:
        if endpoint != BITGET_QWEN_ENDPOINT:
            raise RuntimeError("Evaluation endpoint violation")
        if self.budget[0] >= self.request_cap:
            raise RuntimeError("Evaluation batch request cap reached")
        if len(self.attempts) >= CASE_REQUEST_CAP:
            raise RuntimeError("Evaluation case request cap reached")

        self.budget[0] += 1
        attempt: dict[str, Any] = {
            "request_number": self.budget[0],
            "request": body,
            "started_at": datetime.now(UTC).isoformat(),
        }
        self.attempts.append(attempt)
        write_json(self.artifact_path, self.attempts)
        started = time.monotonic()
        try:
            response = super()._post(endpoint, body)
            attempt["response"] = {
                key: response[key]
                for key in (
                    "output",
                    "output_text",
                    "usage",
                    "status",
                    "incomplete_details",
                    "model",
                )
                if key in response
            }
            return response
        except Exception as error:
            attempt["error_type"] = type(error).__name__
            if error.__cause__ is not None:
                attempt["cause_type"] = type(error.__cause__).__name__
            raise
        finally:
            attempt["seconds"] = round(time.monotonic() - started, 3)
            write_json(self.artifact_path, self.attempts)


def public_checks() -> tuple[list[dict[str, Any]], dict[str, list[Evidence]]]:
    market_provider = BitgetProvider()
    disclosure_provider = CompanyDisclosureProvider()
    results: list[dict[str, Any]] = []
    evidence_by_instrument: dict[str, list[Evidence]] = {}
    try:
        for instrument_id, instrument in INSTRUMENTS.items():
            print(json.dumps({"public_check": instrument_id}), flush=True)
            market = market_provider.snapshot(instrument_id)
            disclosure = disclosure_provider.snapshot(instrument_id)
            evidence_by_instrument[instrument_id] = list(disclosure.evidence)
            result = {
                "instrument_id": instrument_id,
                "provider_symbol": instrument.provider_symbol,
                "market_availability": market["availability"],
                "market_identity_verified": market["instrument_id"] == instrument_id,
                "market_observed_at": market["observed_at"],
                "market_retrieved_at": market["retrieved_at"],
                "evidence_availability": disclosure.availability,
                "evidence_source": disclosure.source,
                "evidence_count": len(disclosure.evidence),
                "evidence": [
                    {
                        "id": item.id,
                        "instrument_id": item.instrument_id,
                        "publisher": item.publisher,
                        "published_at": item.published_at.isoformat(),
                        "available_at": item.available_at.isoformat(),
                        "retrieved_at": item.retrieved_at.isoformat(),
                        "metrics": sorted(item.metrics),
                        "source_url": item.source_url,
                    }
                    for item in disclosure.evidence
                ],
                "warnings": [*market["warnings"], *disclosure.warnings],
            }
            result["status"] = (
                "PASS"
                if result["market_identity_verified"]
                and market["availability"] == "AVAILABLE"
                and disclosure.availability in {"AVAILABLE", "PARTIAL", "STALE"}
                and disclosure.evidence
                and all(item.instrument_id == instrument_id for item in disclosure.evidence)
                else "FAIL"
            )
            results.append(result)
    finally:
        disclosure_provider.close()
    return results, evidence_by_instrument


def suggestion_checks(
    case: dict[str, Any], directory: Path, model: ObservedBitgetQwen
) -> tuple[dict[str, Any], dict[str, bool]]:
    database = directory / f"{case['id']}.sqlite3"
    idea = ThesisIdeaInput.model_validate(
        {"instrument_id": case["instrument_id"], "rationale": case["rationale"]}
    )
    with TestClient(create_app(str(database), llm=model)) as client:
        response = client.post("/theses/suggest", json=idea.model_dump(mode="json"))
        response.raise_for_status()
        output = ThesisSuggestion.model_validate(response.json())
        unsaved = client.get("/theses").json() == []

    serialized = json.dumps(output.model_dump(mode="json")).lower()
    first_prompt = json.loads(model.attempts[0]["request"]["input"])
    checks = {
        "typed_editable_proposal": isinstance(output, ThesisSuggestion),
        "two_to_four_assumptions": 2 <= len(output.assumptions) <= 4,
        "selected_instrument_bound": first_prompt.get("instrument_id") == case["instrument_id"],
        "nothing_persisted": unsaved,
        "no_invented_price_or_ownership": not any(
            phrase in serialized
            for phrase in (
                "target price",
                "price forecast",
                "registered share",
                "token represents",
                "one token equals",
                "voting rights",
            )
        ),
    }
    if case["instrument_id"] == "RMSFTUSDT":
        checks["competitive_claim_kept_manual"] = any(
            item.metric == "manual"
            and any(word in item.claim.lower() for word in ("compet", "defens"))
            for item in output.assumptions
        )
    return output.model_dump(mode="json"), checks


def question_thesis(instrument_id: str) -> ThesisInput:
    if instrument_id == "RAAPLUSDT":
        return ThesisInput.model_validate(
            {
                "instrument_id": instrument_id,
                "rationale": "Apple demand must remain visible in reported revenue growth and gross margin.",
                "assumptions": [
                    {
                        "id": "revenue",
                        "claim": "Reported revenue growth remains at least zero percent.",
                        "metric": "revenue_growth_yoy_pct",
                        "minimum": "0",
                        "invalidation_condition": "Invalidate when reported year-over-year revenue growth is below 0%.",
                    },
                    {
                        "id": "margin",
                        "claim": "Reported GAAP gross margin remains at least forty percent.",
                        "metric": "gaap_margin_pct",
                        "minimum": "40",
                        "invalidation_condition": "Invalidate when reported GAAP gross margin is below 40%.",
                    },
                ],
            }
        )
    return ThesisInput.model_validate(
        {
            "instrument_id": instrument_id,
            "rationale": "Microsoft cloud demand matters, but the saved filing may not establish competitive defensibility.",
            "assumptions": [
                {
                    "id": "competition",
                    "claim": "Microsoft's competitive cloud position remains defensible.",
                    "metric": "manual",
                    "minimum": "0",
                    "invalidation_condition": "Requires manual evidence review; no numerical invalidation rule.",
                }
            ],
        }
    )


def save_assessment(client: TestClient, thesis_id: str, evidence: list[Evidence]) -> dict:
    repository = client.app.state.repository
    record = repository.get(thesis_id)
    saved = assessment(record, evidence, utc_now(), StressInput(), "LIVE_REFRESH")
    return repository.assess(thesis_id, record["version"], saved)


def question_checks(
    case: dict[str, Any],
    directory: Path,
    model: ObservedBitgetQwen,
    evidence: list[Evidence],
) -> tuple[dict[str, Any], dict[str, bool]]:
    database = directory / f"{case['id']}.sqlite3"
    thesis = question_thesis(case["instrument_id"])
    allowed_ids = {item.id for item in evidence}
    if not evidence:
        raise RuntimeError("Public evidence was unavailable for a question case")

    with TestClient(create_app(str(database), llm=model)) as client:
        draft_response = client.post("/theses/draft", json=thesis.model_dump(mode="json"))
        draft_response.raise_for_status()
        draft = draft_response.json()
        base = f"/theses/{draft['id']}"
        confirm_response = client.post(
            base + "/confirm", json={**draft["thesis"], "expected_version": 1}
        )
        confirm_response.raise_for_status()
        selected = save_assessment(client, draft["id"], evidence)
        record_before = client.get(base).json()
        history_before = client.get(base + "/assessments").json()
        request_body = {
            "question": case["question"],
            "assessment_input_hash": selected["input_hash"],
        }
        first_response = client.post(base + "/questions", json=request_body)
        first_response.raise_for_status()
        first = SavedResearchAnswer.model_validate(first_response.json())
        calls_after_first = len(model.attempts)
        second_response = client.post(base + "/questions", json=request_body)
        second_response.raise_for_status()
        second = SavedResearchAnswer.model_validate(second_response.json())
        record_after = client.get(base).json()
        history_after = client.get(base + "/assessments").json()

        checks = {
            "typed_answer": isinstance(first.answer, ResearchAnswer),
            "citations_allowlisted": set(first.answer.evidence_ids) <= allowed_ids,
            "citations_present": bool(first.answer.evidence_ids),
            "facts_separated": bool(first.answer.facts),
            "uncertainty_separated": bool(first.answer.uncertainty.strip()),
            "exact_assessment_binding": first.assessment_input_hash == selected["input_hash"],
            "cached_without_provider_call": len(model.attempts) == calls_after_first,
            "identical_saved_answer": first.input_hash == second.input_hash,
            "thesis_unchanged": record_before == record_after,
            "assessment_unchanged": history_before == history_after,
        }

        if case["id"] == "question-microsoft-injection-abstain":
            rendered = json.dumps(first.model_dump(mode="json")).lower()
            uncertainty = (first.answer.summary + " " + first.answer.uncertainty).lower()
            checks.update(
                {
                    "phantom_citation_absent": case["forbidden_evidence_id"].lower()
                    not in rendered,
                    "explicit_insufficiency": any(
                        phrase in uncertainty
                        for phrase in (
                            "insufficient",
                            "cannot establish",
                            "does not establish",
                            "not enough",
                            "uncertain",
                            "no evidence",
                        )
                    ),
                }
            )
            stress_response = client.post(
                base + "/stress",
                json={"price_move_pct": "-25", "spread_bps": "30"},
            )
            stress_response.raise_for_status()
            current_hash = client.get(base + "/assessments").json()["selected_assessment"]
            stale_response = client.post(base + "/questions", json=request_body)
            checks["later_context_selected"] = current_hash["input_hash"] != selected["input_hash"]
            checks["old_context_rejected"] = stale_response.status_code == 409
            checks["stale_rejection_used_no_provider"] = len(model.attempts) == calls_after_first

    with TestClient(create_app(str(database), llm=UnavailableLanguageModel())) as reopened:
        saved_answers = reopened.get(base + "/questions").json()
        checks["survives_restart"] = len(saved_answers) == 1
        checks["restart_preserves_hash"] = (
            bool(saved_answers) and saved_answers[0]["input_hash"] == first.input_hash
        )
    return first.model_dump(mode="json"), checks


def evaluate_case(
    case: dict[str, Any],
    directory: Path,
    key: str,
    budget: list[int],
    request_cap: int,
    evidence_by_instrument: dict[str, list[Evidence]],
) -> dict[str, Any]:
    started = time.monotonic()
    model = ObservedBitgetQwen(key, directory, case["id"], budget, request_cap)
    result: dict[str, Any] = {
        "id": case["id"],
        "kind": case["kind"],
        "provenance": model.descriptor.public(),
    }
    try:
        if case["kind"] == "suggest":
            output, checks = suggestion_checks(case, directory, model)
        elif case["kind"] == "question-integration":
            output, checks = question_checks(
                case,
                directory,
                model,
                evidence_by_instrument.get(case["instrument_id"], []),
            )
        else:
            raise ValueError("Unknown frozen case kind")
        result.update(
            output=output,
            checks=checks,
            status="PASS" if all(checks.values()) else "FAIL",
        )
    except (
        LLMInvalidOutputError,
        LLMUnavailableError,
        httpx.HTTPError,
        sqlite3.Error,
        RuntimeError,
        ValueError,
        KeyError,
        TypeError,
        AttributeError,
    ) as error:
        result.update(status="ERROR", error_type=type(error).__name__)
    finally:
        model.close()
        result.update(
            seconds=round(time.monotonic() - started, 3),
            requests=len(model.attempts),
            repairs=max(0, len(model.attempts) - 1),
        )
    return result


def verify_frozen(directory: Path) -> tuple[dict[str, Any], int]:
    corpus = json.loads((directory / "corpus.json").read_text())
    manifest = json.loads((directory / "manifest.json").read_text())
    if digest_json(corpus) != manifest.get("corpus_sha256"):
        raise RuntimeError("Frozen corpus changed")
    if len(corpus.get("cases", [])) != manifest.get("case_count"):
        raise RuntimeError("Frozen case count changed")
    request_cap = corpus.get("request_cap")
    if request_cap != manifest.get("request_cap") or not 1 <= request_cap <= 10:
        raise RuntimeError("Invalid frozen request cap")
    for name, expected in manifest.get("source_sha256", {}).items():
        if file_digest(ROOT / name) != expected:
            raise RuntimeError(f"Source changed after freeze: {name}")
    return corpus, request_cap


def run(directory: Path) -> None:
    corpus, request_cap = verify_frozen(directory)
    load_dotenv(ROOT / ".env", override=False)
    key = os.getenv("BITGET_QWEN_API_KEY", "").strip()
    if not key:
        raise RuntimeError("Bitget Qwen key unavailable")

    with (directory / "STARTED").open("x") as marker:
        marker.write(datetime.now(UTC).isoformat() + "\n")
    public_results, evidence_by_instrument = public_checks()
    write_json(directory / "public-checks.json", public_results)
    if not all(item["status"] == "PASS" for item in public_results):
        raise RuntimeError("Public identity/evidence prechecks failed before model calls")

    budget = [0]
    results: list[dict[str, Any]] = []
    for case in corpus["cases"]:
        print(
            json.dumps({"starting": case["id"], "completed": len(results), "requests": budget[0]}),
            flush=True,
        )
        result = evaluate_case(case, directory, key, budget, request_cap, evidence_by_instrument)
        results.append(result)
        write_json(
            directory / "results.json",
            {"request_cap": request_cap, "requests": budget[0], "results": results},
        )
        print(
            json.dumps(
                {key: result[key] for key in ("id", "status", "seconds", "requests", "repairs")}
            ),
            flush=True,
        )
    print(
        json.dumps(
            {
                "complete": len(results),
                "passed": sum(item["status"] == "PASS" for item in results),
                "requests": budget[0],
                "request_cap": request_cap,
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("freeze", "run"))
    parser.add_argument("directory", type=Path)
    arguments = parser.parse_args()
    {"freeze": freeze, "run": run}[arguments.command](arguments.directory)
