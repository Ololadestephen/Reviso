"""Freeze then run three approved AI actions, at most six provider requests.

PYTHONPATH=. .venv/bin/python scripts/final_live_validation.py freeze DIRECTORY
PYTHONPATH=. .venv/bin/python scripts/final_live_validation.py run DIRECTORY

Run spends credit. Frozen directories cannot be rerun. Only constructed NVIDIA
research is sent; credentials and HTTP headers are never written to artifacts.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from datetime import UTC, datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.contracts import ThesisIdeaInput, ThesisInput
from backend.llm import (
    BITGET_QWEN_ENDPOINT,
    GROQ_ENDPOINT,
    BitgetQwenLanguageModel,
    GroqLanguageModel,
    UnavailableLanguageModel,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "backend/api.py",
    "backend/contracts.py",
    "backend/instruments.py",
    "backend/llm.py",
    "backend/research_context.py",
    "backend/research_chat.py",
    "backend/routes.py",
    "backend/services.py",
    "backend/storage.py",
    "backend/replay.py",
    "scripts/final_live_validation.py",
)
THESIS = {
    "rationale": "NVIDIA can maintain margins and revenue growth.",
    "assumptions": [
        {
            "id": "margin",
            "claim": "GAAP margin remains at least 75%",
            "metric": "gaap_margin_pct",
            "minimum": "75",
            "invalidation_condition": "Invalidate when reported GAAP gross margin is below 75%.",
        },
        {
            "id": "growth",
            "claim": "Revenue growth remains at least 80%",
            "metric": "revenue_growth_yoy_pct",
            "minimum": "80",
            "invalidation_condition": "Invalidate when reported year-over-year revenue growth is below 80%.",
        },
    ],
}
CORPUS = {
    "instrument_id": "RNVDAUSDT",
    "request_cap": 6,
    "per_action_cap": 2,
    "actions": ["draft", "mixed_review", "cited_followup"],
    "draft_idea": "NVIDIA can maintain GAAP gross margin of at least 75% and year-over-year revenue growth of at least 80%.",
    "confirmed_thesis": THESIS,
    "historical_replay_step": 1,
    "question": "Why did one condition fail while the other held? What should I check next?",
    "checks": [
        "issuer_supported_draft",
        "mixed_saved_stances_and_citations",
        "cited_facts_and_uncertainty",
        "cache_without_paid_calls",
        "restart_persistence",
    ],
}


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2) + "\n")


def fingerprint() -> dict:
    return {
        "corpus": CORPUS,
        "source_sha256": {
            name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in SOURCES
        },
    }


def freeze(directory: Path) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / "manifest.json").open("x") as handle:
        json.dump(fingerprint(), handle, indent=2)
        handle.write("\n")
    print(json.dumps({"frozen": str(directory), "actions": 3, "request_cap": 6}), flush=True)


class RequestBudget:
    def __init__(self, directory: Path):
        self.directory = directory
        self.attempts: list[dict] = []
        self.action = "draft"

    def reserve(self, endpoint: str) -> dict:
        if endpoint not in {BITGET_QWEN_ENDPOINT, GROQ_ENDPOINT}:
            raise RuntimeError("Unapproved provider endpoint")
        count = sum(item["action"] == self.action for item in self.attempts)
        if len(self.attempts) >= 6 or count >= 2:
            raise RuntimeError("Approved live request ceiling reached")
        attempt = {
            "number": len(self.attempts) + 1,
            "action": self.action,
            "started_at": datetime.now(UTC).isoformat(),
            "endpoint": endpoint,
        }
        self.attempts.append(attempt)
        self.save()
        return attempt

    def save(self) -> None:
        write_json(self.directory / "requests.json", self.attempts)


class ObservedRequests:
    budget: RequestBudget

    def _post(self, endpoint: str, body: dict) -> dict:
        attempt = self.budget.reserve(endpoint)
        started = time.monotonic()
        try:
            response = super()._post(endpoint, body)
            attempt["response"] = {
                key: response[key]
                for key in (
                    "output",
                    "output_text",
                    "choices",
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
            if error.__cause__:
                attempt["cause_type"] = type(error.__cause__).__name__
            raise
        finally:
            attempt["seconds"] = round(time.monotonic() - started, 3)
            self.budget.save()


class ObservedGroq(ObservedRequests, GroqLanguageModel):
    pass


class ObservedBitget(ObservedRequests, BitgetQwenLanguageModel):
    pass


def require_ok(response) -> dict:
    if not 200 <= response.status_code < 300:
        raise RuntimeError(f"Application HTTP {response.status_code}")
    return response.json()


def action(budget: RequestBudget, results: list[dict], name: str, operation) -> None:
    budget.action = name
    started = time.monotonic()
    result = {"action": name}
    try:
        result["output"] = operation()
        result["status"] = "PASS"
    except (AssertionError, RuntimeError, KeyError, ValueError) as error:
        result.update(status="FAIL", error_type=type(error).__name__)
    result["seconds"] = round(time.monotonic() - started, 3)
    result["requests"] = sum(item["action"] == name for item in budget.attempts)
    results.append(result)
    write_json(budget.directory / "results.json", results)
    print(json.dumps({key: value for key, value in result.items() if key != "output"}), flush=True)


def run(directory: Path) -> None:
    if json.loads((directory / "manifest.json").read_text()) != fingerprint():
        raise RuntimeError("Frozen inputs or sources changed; refusing live calls")
    load_dotenv(ROOT / ".env", override=False)
    if not all(os.environ.get(key) for key in ("BITGET_QWEN_API_KEY", "GROQ_API_KEY")):
        raise RuntimeError("Both server-side provider keys are required")
    with (directory / "STARTED").open("x") as marker:
        marker.write(datetime.now(UTC).isoformat() + "\n")
    # This process uses only its disposable database, never the user's app DB.
    os.environ.update(REVISO_PUBLIC_DEMO="0", REVISO_SERVE_WEB="0", REVISO_AUTH_MODE="local")
    budget = RequestBudget(directory)
    draft = ObservedGroq(
        os.environ["GROQ_API_KEY"],
        model=os.environ.get("REVISO_DRAFT_MODEL", "openai/gpt-oss-20b"),
        reasoning_effort="low",
    )
    review = ObservedBitget(os.environ["BITGET_QWEN_API_KEY"])
    chat = ObservedGroq(
        os.environ["GROQ_API_KEY"], model=os.environ.get("REVISO_LLM_MODEL", "qwen/qwen3.8-27b")
    )
    for model in (draft, review, chat):
        model.budget = budget
    database = directory / "isolated.sqlite3"
    results: list[dict] = []
    with TestClient(
        create_app(str(database), llm=review, chat_llm=chat, draft_llm=draft)
    ) as client:
        idea = ThesisIdeaInput(
            instrument_id=CORPUS["instrument_id"], rationale=CORPUS["draft_idea"]
        )
        action(
            budget,
            results,
            "draft",
            lambda: require_ok(client.post("/theses/suggest", json=idea.model_dump(mode="json"))),
        )
        record = require_ok(
            client.post(
                "/theses/draft", json=ThesisInput.model_validate(THESIS).model_dump(mode="json")
            )
        )
        base = f"/theses/{record['id']}"
        require_ok(client.post(base + "/confirm", json={**record["thesis"], "expected_version": 1}))
        selected = require_ok(
            client.post(
                "/replays/nvidia-margin/step",
                json={"thesis_id": record["id"], "expected_version": 2, "step": 1},
            )
        )
        assert [item["state"] for item in selected["assumptions"]] == ["INVALIDATED", "SUPPORTED"]

        def mixed_review():
            output = require_ok(client.post(base + "/ai-review"))
            items = output["narrative_review"]["items"]
            assert {item["assumption_id"]: item["stance"] for item in items} == {
                "margin": "CONTRADICTS",
                "growth": "SUPPORTS",
            }
            assert all(item["evidence_ids"] for item in items)
            before = len(budget.attempts)
            assert require_ok(client.post(base + "/ai-review")) == output
            assert len(budget.attempts) == before
            return output

        action(budget, results, "mixed_review", mixed_review)
        selected = require_ok(client.get(base + "/assessments"))["selected_assessment"]
        question = {"assessment_input_hash": selected["input_hash"], "question": CORPUS["question"]}

        def followup():
            thread = require_ok(client.post(base + "/conversation", json=question))
            answer = thread["messages"][-1]["answer"]
            assert answer["facts"] and answer["evidence_ids"] and answer["uncertainty"]
            before = len(budget.attempts)
            assert require_ok(client.post(base + "/conversation", json=question)) == thread
            assert len(budget.attempts) == before
            return thread

        action(budget, results, "cited_followup", followup)
    # Read persisted data with unavailable providers: restart cannot spend credit.
    with TestClient(create_app(str(database), llm=UnavailableLanguageModel())) as client:
        history = require_ok(client.get(base + "/assessments"))
        persisted = require_ok(
            client.get(
                base + "/conversation",
                params={"assessment_input_hash": history["selected_assessment"]["input_hash"]},
            )
        )
        passed_chat = next(
            (
                item["output"]
                for item in results
                if item["action"] == "cited_followup" and item["status"] == "PASS"
            ),
            None,
        )
        assert passed_chat is None or persisted == passed_chat
        write_json(directory / "persistence.json", {"history": history, "conversation": persisted})
    print(
        json.dumps(
            {
                "completed": True,
                "provider_requests": len(budget.attempts),
                "passed": sum(item["status"] == "PASS" for item in results),
            }
        ),
        flush=True,
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["freeze", "run"])
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    (freeze if args.command == "freeze" else run)(args.directory.resolve())
