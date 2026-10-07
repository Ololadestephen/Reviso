"""Saved source integration: immutable checks, ownership, AI boundaries and exports."""

import json
from datetime import timedelta
from io import BytesIO

import httpx
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from backend.api import create_app
from backend.contracts import Assumption, ResearchAnswer, State, StressInput, utc_now
from backend.llm import GroqLanguageModel, LLMInvalidOutputError
from backend.official_research import OfficialResearchProvider, research_evidence
from backend.replay import CUTOFFS, available_evidence
from backend.services import assessment, narrative_context_hash
from backend.storage import ConflictError
from tests.auth_helpers import csrf_headers, sign_in, simulated_client
from tests.official_fixtures import NOW
from tests.test_llm import FakeLanguageModel, completion, valid_review
from tests.test_official_research import official_response


def seed_live(client, app, thesis, *, mode="LIVE_REFRESH", stale=False):
    draft = client.post(
        "/theses/draft", json=thesis.model_dump(mode="json"), headers=csrf_headers(client)
    ).json()
    record = client.post(
        f"/theses/{draft['id']}/confirm",
        json={**draft["thesis"], "expected_version": 1},
        headers=csrf_headers(client),
    ).json()
    owner = client.get("/auth/me").json()["user_id"]
    evidence = [
        available_evidence(CUTOFFS[0])[-1].model_copy(
            update={
                "published_at": NOW - timedelta(days=5),
                "available_at": NOW - timedelta(days=5),
                "observed_at": NOW.replace(month=6, day=30),
            }
        )
    ]
    if stale:
        evidence[0].available_at = NOW - timedelta(days=121)
    check = assessment(record, evidence, utc_now(), StressInput(), mode)
    app.state.repository.assess(owner, record["id"], record["version"], check)
    return record, owner, check


def fixture_provider(app):
    client = httpx.Client(transport=httpx.MockTransport(official_response))
    app.state.official_research.close()
    app.state.official_research = OfficialResearchProvider(
        client, sec_user_agent="test contact@example.test", clock=lambda: NOW
    )
    return client


def test_load_is_unpaid_immutable_and_survives_restart_with_exported_citations(tmp_path, thesis):
    path = str(tmp_path / "sources.sqlite3")
    model = FakeLanguageModel()
    app = create_app(path, llm=model)
    with TestClient(app) as client:
        transport = fixture_provider(app)
        record, owner, before = seed_live(client, app, thesis)
        base = f"/theses/{record['id']}"
        response = client.post(
            base + "/research-context", json={"assessment_input_hash": before["input_hash"]}
        )
        assert response.status_code == 200, response.text
        result = response.json()
        assert result["research_base_input_hash"] == before["input_hash"]
        assert result["input_hash"] != before["input_hash"]
        assert (
            result["assumptions"] == before["assumptions"]
            and result["numerical"] == before["numerical"]
        )
        assert len(result["research_sources"]) == 5
        assert model.review_calls == model.answer_calls == 0
        assert (
            app.state.repository.assessment_by_hash(owner, record["id"], before["input_hash"])
            == before
        )
        source = result["research_sources"][0]
        assert client.get("/evidence/" + source["id"]).json()["kind"] == source["kind"]
        assert "Additional research" in client.get(base + "/export?format=markdown").text
        pdf = client.get(base + "/export?format=pdf")
        assert pdf.status_code == 200
        text = "\n".join(page.extract_text() for page in PdfReader(BytesIO(pdf.content)).pages)
        assert "Additional research" in text and "MONETARY_POLICY" in text
        assert len(client.get(base + "/assessments").json()["assessments"]) == 2
        transport.close()
    with TestClient(create_app(path, llm=FakeLanguageModel())) as reopened:
        saved = reopened.get(base + "/assessments").json()["selected_assessment"]
        assert saved == result
        assert reopened.get("/evidence/" + source["id"]).status_code == 200
        assert reopened.get(base + "/export?format=json").json()["selected_assessment"] == result


@pytest.mark.parametrize("mode", ["HISTORICAL_REPLAY", "CONTROLLED_SCENARIO"])
def test_historical_and_controlled_checks_never_load_current_sources(tmp_path, thesis, mode):
    app = create_app(str(tmp_path / "history.sqlite3"), llm=FakeLanguageModel())
    with TestClient(app) as client:
        record, _, before = seed_live(client, app, thesis, mode=mode)
        response = client.post(
            f"/theses/{record['id']}/research-context",
            json={"assessment_input_hash": before["input_hash"]},
        )
        assert response.status_code == 409
        assert "current filing" in response.json()["detail"]
        assert len(client.get(f"/theses/{record['id']}/assessments").json()["assessments"]) == 1


def test_new_sources_do_not_rescue_stale_numbers_or_confirm_manual_conditions(tmp_path, thesis):
    manual = Assumption(
        id="demand",
        claim="Demand remains healthy based on company discussion.",
        metric="manual",
        minimum=0,
        invalidation_condition="Requires manual evidence review; no numerical invalidation rule.",
    )
    thesis = thesis.model_copy(update={"assumptions": [*thesis.assumptions, manual]})
    app = create_app(str(tmp_path / "stale.sqlite3"), llm=FakeLanguageModel())
    with TestClient(app) as client:
        transport = fixture_provider(app)
        record, _, before = seed_live(client, app, thesis, stale=True)
        response = client.post(
            f"/theses/{record['id']}/research-context",
            json={"assessment_input_hash": before["input_hash"]},
        )
        result = response.json()
        assert all(item["state"] == State.INSUFFICIENT for item in result["assumptions"])
        assert result["state"] == State.INSUFFICIENT and result["research_sources"]
        assert all(
            item.metrics == {} for item in research_evidence(result) if item.kind != "COMPANY_FACTS"
        )
        assert narrative_context_hash(thesis, research_evidence(before)) != narrative_context_hash(
            thesis, research_evidence(result)
        )
        transport.close()


def test_owner_csrf_and_selection_guards_prevent_loading_or_reading_anothers_sources(
    tmp_path, monkeypatch, thesis
):
    app = simulated_client(tmp_path, monkeypatch, llm=FakeLanguageModel())
    with TestClient(app) as client:
        transport = fixture_provider(app)
        sign_in(client, "alice")
        record, owner, before = seed_live(client, app, thesis)
        base = f"/theses/{record['id']}"
        payload = {"assessment_input_hash": before["input_hash"]}
        assert client.post(base + "/research-context", json=payload).status_code == 403
        assert (
            client.post(
                base + "/research-context",
                json={"assessment_input_hash": "f" * 64},
                headers=csrf_headers(client),
            ).status_code
            == 409
        )
        result = client.post(
            base + "/research-context", json=payload, headers=csrf_headers(client)
        ).json()
        assert (
            client.post(
                base + "/research-context", json=payload, headers=csrf_headers(client)
            ).status_code
            == 409
        )
        # Atomic compare-and-select protects against a check changed during retrieval.
        with pytest.raises(ConflictError, match="selection"):
            app.state.repository.assess(
                owner,
                record["id"],
                record["version"],
                before,
                expected_selection=before["input_hash"],
            )
        sign_in(client, "bob")
        assert client.get(base + "/assessments").status_code == 404
        assert client.get("/evidence/" + result["research_sources"][0]["id"]).status_code == 404
        assert (
            client.post(
                base + "/research-context", json=payload, headers=csrf_headers(client)
            ).status_code
            == 404
        )
        transport.close()


def test_macro_only_support_is_repaired_and_then_rejected_with_bounded_calls(thesis):
    with httpx.Client(transport=httpx.MockTransport(official_response)) as transport:
        provider = OfficialResearchProvider(
            transport, sec_user_agent="test contact@example.test", clock=lambda: NOW
        )
        sources = provider.snapshot(thesis.instrument_id, NOW.replace(month=6, day=30)).sources
    macro = next(source for source in sources if source.kind == "MONETARY_POLICY")
    manual = Assumption(
        id="demand",
        claim="Company demand remains healthy based on research.",
        metric="manual",
        minimum=0,
        invalidation_condition="Requires manual evidence review; no numerical invalidation rule.",
    )
    thesis = thesis.model_copy(update={"assumptions": [manual]})
    calls = []

    def respond(request):
        calls.append(json.loads(request.content))
        return completion(valid_review(thesis, macro.id))

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        model = GroqLanguageModel("test-only", client=client)
        with pytest.raises(LLMInvalidOutputError, match="local validation"):
            model.review(thesis, sources)
    assert len(calls) == 2
    for call in calls:
        payload = json.loads(call["messages"][1]["content"])
        assert {item["kind"] for item in payload["allowlisted_evidence"]} == {
            "COMPANY_REPORT",
            "MONETARY_POLICY",
            "ECONOMIC_DATA",
        }
        assert "economy-wide" in call["messages"][1]["content"]


def test_chat_and_review_receive_supplemental_citations_without_mutating_engine(tmp_path, thesis):
    class CapturingModel(FakeLanguageModel):
        def answer(self, thesis, evidence, question, history=None, detail=False, finding=None):
            self.sources = evidence
            source = next(item for item in evidence if item.kind == "MONETARY_POLICY")
            self.answer_calls += 1
            return ResearchAnswer(
                summary="The policy statement gives wider economic context.",
                facts=["The Committee published its policy statement."],
                uncertainty="This does not prove company demand.",
                evidence_ids=[source.id],
            )

        def review(self, thesis, evidence, finding=None):
            self.review_sources = evidence
            return super().review(thesis, evidence, finding=finding)

    model = CapturingModel()
    app = create_app(str(tmp_path / "chat.sqlite3"), llm=model)
    with TestClient(app) as client:
        transport = fixture_provider(app)
        record, _, before = seed_live(client, app, thesis)
        base = f"/theses/{record['id']}"
        result = client.post(
            base + "/research-context", json={"assessment_input_hash": before["input_hash"]}
        ).json()
        reviewed = client.post(base + "/ai-review").json()
        assert len(model.review_sources) == 6
        assert reviewed["assumptions"] == result["assumptions"]
        assert reviewed["research_sources"] == result["research_sources"]
        response = client.post(
            base + "/conversation",
            json={
                "assessment_input_hash": reviewed["input_hash"],
                "question": "What does Fed policy say?",
                "detail": False,
            },
        )
        assert response.status_code == 200, response.text
        assert len(model.sources) == 6
        assert response.json()["messages"][-1]["evidence_ids"]
        old = client.post(
            base + "/conversation",
            json={
                "assessment_input_hash": before["input_hash"],
                "question": "What changed?",
                "detail": False,
            },
        )
        assert old.status_code == 409
        transport.close()
