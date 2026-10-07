"""Offline rehearsal of frozen official-source validation; no paid/public network."""

import json
from datetime import timedelta
from decimal import Decimal

import httpx
import pytest

from backend.disclosures import DisclosureSnapshot
from backend.official_research import OfficialResearchProvider
from backend.replay import DOCUMENTS
from scripts import official_research_live_validation as validation
from tests.official_fixtures import NOW
from tests.test_llm import completion
from tests.test_official_research import official_response


@pytest.fixture
def frozen_batch(tmp_path, monkeypatch):
    class Disclosure:
        def snapshot(self, instrument_id):
            evidence = DOCUMENTS[0].model_copy(
                update={
                    "published_at": NOW - timedelta(days=5),
                    "available_at": NOW - timedelta(days=4),
                    "observed_at": NOW.replace(month=6, day=30),
                    "metrics": {
                        "gaap_margin_pct": Decimal(75),
                        "revenue_growth_yoy_pct": Decimal(106),
                    },
                }
            )
            return DisclosureSnapshot(
                availability="AVAILABLE", checked_at=NOW, evidence=[evidence], warnings=[]
            )

        def close(self):
            pass

    monkeypatch.setattr(validation, "CompanyDisclosureProvider", Disclosure)
    monkeypatch.setattr(
        validation,
        "OfficialResearchProvider",
        lambda: OfficialResearchProvider(
            httpx.Client(transport=httpx.MockTransport(official_response)),
            sec_user_agent="test contact@example.test",
            clock=lambda: NOW,
        ),
    )
    monkeypatch.setattr(validation, "load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("BITGET_QWEN_API_KEY", "test-only")
    monkeypatch.setenv("GROQ_API_KEY", "test-only")
    validation.freeze(tmp_path)
    return tmp_path


def test_freeze_and_run_refuse_changed_inputs_and_duplicate_freeze(frozen_batch):
    with pytest.raises(FileExistsError):
        validation.freeze(frozen_batch)
    (frozen_batch / "packet.json").write_text("{}")
    with pytest.raises(AssertionError, match="Packet changed"):
        validation.run(frozen_batch)
    assert not (frozen_batch / "STARTED").exists()


def test_official_harness_rehearses_three_actions_cache_restart_and_exports(
    frozen_batch, monkeypatch
):
    packet = json.loads((frozen_batch / "packet.json").read_text())
    financial_id = packet["financial"]["evidence"][0]["id"]
    report_id = next(
        item["id"] for item in packet["research"]["sources"] if item["kind"] == "COMPANY_REPORT"
    )
    macro_id = next(
        item["id"] for item in packet["research"]["sources"] if item["kind"] == "MONETARY_POLICY"
    )
    calls = []

    def respond(request):
        body = json.loads(request.content)
        calls.append(body)
        if "instructions" in body:
            output = {
                "summary": "Growth misses its floor; margin meets it. Peer demand is unknown.",
                "items": [
                    {
                        "assumption_id": name,
                        "stance": stance,
                        "evidence_ids": [financial_id] if name != "peers" else [],
                        "explanation": "Saved comparison."
                        if name != "peers"
                        else "No peer comparison supplied.",
                    }
                    for name, stance in packet["expected_stances"].items()
                ],
                "next_question": "What does comparable peer evidence show?",
            }
            return httpx.Response(200, json={"output_text": json.dumps(output)})
        return completion(
            {
                "summary": {
                    "text": "Company commentary is not independent proof."
                    if len(calls) == 2
                    else "Economy-wide data does not prove NVIDIA performance.",
                    "evidence_ids": [report_id if len(calls) == 2 else macro_id],
                },
                "facts": [
                    {
                        "text": "A supplied official passage was published.",
                        "evidence_ids": [report_id if len(calls) == 2 else macro_id],
                    }
                ],
                "uncertainty": {
                    "text": "Future margin and the peer comparison remain unknown.",
                    "evidence_ids": [],
                },
            }
        )

    real_bitget, real_groq = validation.ObservedBitget, validation.ObservedGroq
    monkeypatch.setattr(
        validation,
        "ObservedBitget",
        lambda key: real_bitget(key, client=httpx.Client(transport=httpx.MockTransport(respond))),
    )
    monkeypatch.setattr(
        validation,
        "ObservedGroq",
        lambda key, **kwargs: real_groq(
            key, client=httpx.Client(transport=httpx.MockTransport(respond)), **kwargs
        ),
    )
    validation.run(frozen_batch)
    results = json.loads((frozen_batch / "results.json").read_text())
    assert [item["status"] for item in results] == ["PASS"] * 3
    assert len(calls) == 3
    assert (frozen_batch / "persistence.json").exists()
    with pytest.raises(FileExistsError):
        validation.run(frozen_batch)
    assert len(calls) == 3


def test_official_harness_refuses_changed_code_before_calls(frozen_batch, monkeypatch):
    monkeypatch.setattr(validation, "source_hashes", dict)
    with pytest.raises(AssertionError, match="Source code changed"):
        validation.run(frozen_batch)
    assert not (frozen_batch / "STARTED").exists()


def test_chat_only_rehearses_one_call_without_review_or_other_questions(tmp_path, monkeypatch):
    monkeypatch.setattr(validation, "load_dotenv", lambda *args, **kwargs: None)
    monkeypatch.setenv("GROQ_API_KEY", "test-only")
    monkeypatch.delenv("BITGET_QWEN_API_KEY", raising=False)
    validation.freeze_chat(tmp_path)
    packet = json.loads((tmp_path / "packet.json").read_text())
    report_id = next(
        item["id"] for item in packet["research"]["sources"] if item["kind"] == "COMPANY_REPORT"
    )
    calls = []

    def respond(request):
        calls.append(request)
        return completion(
            {
                "summary": {
                    "text": "The supplied passage is company commentary.",
                    "evidence_ids": [report_id],
                },
                "facts": [{"text": "It is not independent proof.", "evidence_ids": [report_id]}],
                "uncertainty": {"text": "The peer comparison remains missing.", "evidence_ids": []},
            }
        )

    real_groq = validation.ObservedGroq
    monkeypatch.setattr(
        validation,
        "ObservedGroq",
        lambda key, **kwargs: real_groq(
            key, client=httpx.Client(transport=httpx.MockTransport(respond)), **kwargs
        ),
    )
    validation.run(tmp_path)
    assert len(calls) == 1
    assert json.loads((tmp_path / "results.json").read_text())[0]["status"] == "PASS"
    assert (tmp_path / "persistence.json").exists()
    with pytest.raises(FileExistsError):
        validation.run(tmp_path)
    assert len(calls) == 1
