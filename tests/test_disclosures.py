"""Synthetic layout fixtures test parsing boundaries; live inspection is separate."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

import httpx
import pytest
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.company_disclosures import CompanyDisclosureProvider
from backend.disclosure_parser import parse_disclosure
from backend.disclosures import (
    INDEX_URL,
    MAX_BYTES,
    ORIGIN,
    NvidiaDisclosureProvider,
    allowed_url,
    latest_release,
)

NOW = datetime(2026, 9, 11, tzinfo=UTC)
PATH = "/news/nvidia-announces-financial-results-for-second-quarter-fiscal-2027"
URL = ORIGIN + PATH
HTML = """<h1 class="article-title">NVIDIA Announces Financial Results for Second Quarter Fiscal 2027</h1>
<div class="article-date">August 26, 2026</div><div class="article-body">
<p>NVIDIA (NASDAQ: NVDA) today reported revenue for the second quarter ended July 26, 2026, of $90 billion, up 12% from the previous quarter and up 90% from a year ago.</p>
<table><tr><td>GAAP</td></tr><tr><td>Metric</td><td>Q2 FY27</td><td>Q1 FY27</td></tr>
<tr><td>Gross margin</td><td>74.0 %</td><td>76.0 %</td></tr></table>
<table><tr><td>Non-GAAP</td></tr><tr><td>Metric</td><td>Q2 FY27</td></tr>
<tr><td>Gross margin</td><td>99.0 %</td></tr></table>
<p>Outlook: GAAP gross margin is expected to be 98%.</p></div>"""


def provider_for(html=HTML, index=None):
    calls = []

    def handler(request):
        calls.append(str(request.url))
        body = (index or f'<a href="{PATH}">Release</a>') if str(request.url) == INDEX_URL else html
        return httpx.Response(200, text=body, headers={"content-type": "text/html"})

    return NvidiaDisclosureProvider(httpx.Client(transport=httpx.MockTransport(handler))), calls


def test_reported_metrics_and_dates_are_distinct_from_outlook():
    evidence = parse_disclosure(HTML, URL, NOW)
    assert evidence.metrics == {
        "gaap_margin_pct": Decimal("74.0"),
        "revenue_growth_yoy_pct": Decimal(90),
    }
    assert evidence.observed_at == datetime(2026, 7, 26, tzinfo=UTC)
    assert evidence.available_at == datetime(2026, 8, 27, tzinfo=UTC)
    assert evidence.retrieved_at == NOW
    assert evidence.origin == "PUBLIC_RETRIEVAL"
    assert "98%" not in evidence.excerpt and "99.0" not in evidence.excerpt
    assert evidence.id == parse_disclosure(HTML, URL, NOW + timedelta(days=1)).id
    assert evidence.id != parse_disclosure(HTML.replace("74.0", "73.0"), URL, NOW).id


@pytest.mark.parametrize("replacement", ["Non-GAAP", "Unknown"])
def test_unrecognized_table_does_not_invent_gaap_margin(replacement):
    evidence = parse_disclosure(HTML.replace(">GAAP<", f">{replacement}<"), URL, NOW)
    assert "gaap_margin_pct" not in evidence.metrics


def test_duplicate_metric_and_missing_date_abstain():
    duplicate = HTML.replace("</table>", "<tr><td>Gross margin</td><td>75.0 %</td></tr></table>", 1)
    assert "gaap_margin_pct" not in parse_disclosure(duplicate, URL, NOW).metrics
    with pytest.raises(ValueError):
        parse_disclosure(HTML.replace("article-date", "unknown-date"), URL, NOW)


def test_wrong_period_and_future_publication_are_rejected():
    with pytest.raises(ValueError):
        parse_disclosure(HTML, URL.replace("second", "first"), NOW)
    with pytest.raises(ValueError):
        parse_disclosure(HTML.replace("second quarter ended", "first quarter ended"), URL, NOW)
    with pytest.raises(ValueError):
        parse_disclosure(HTML.replace("August 26, 2026", "December 26, 2026"), URL, NOW)


def test_partial_latest_report_does_not_borrow_an_older_metric(monkeypatch):
    monkeypatch.setattr("backend.disclosures.utc_now", lambda: NOW)
    model, calls = provider_for(HTML.replace(">GAAP<", ">Non-GAAP<"))
    try:
        result = model.snapshot()
        assert result.availability == "PARTIAL"
        assert "gaap_margin_pct" not in result.evidence[0].metrics
        assert len(calls) == 2
    finally:
        model.close()


def test_latest_release_failure_never_falls_back_to_older_release():
    calls = []

    def handler(request):
        calls.append(str(request.url))
        if str(request.url) == INDEX_URL:
            return httpx.Response(
                200,
                text=f'<a href="{PATH}">new</a><a href="{PATH.replace("second", "first")}">old</a>',
                headers={"content-type": "text/html"},
            )
        return httpx.Response(503)

    model = NvidiaDisclosureProvider(httpx.Client(transport=httpx.MockTransport(handler)))
    try:
        assert model.snapshot().availability == "UNAVAILABLE"
        assert calls == [INDEX_URL, URL]
    finally:
        model.close()


def test_discovery_filters_links_and_sorts_fiscal_period():
    html = f'<a href="{PATH}">latest</a><a href="/news/nvidia-announces-financial-results-for-first-quarter-fiscal-2027">old</a>'
    html += '<a href="https://attacker.example/news/nvidia-announces-financial-results-for-first-quarter-fiscal-2099">bad</a>'
    assert latest_release(html) == URL
    for url in [
        URL + "?redirect=evil",
        URL + "#x",
        "http://nvidianews.nvidia.com" + PATH,
        "https://nvidianews.nvidia.com.evil.com" + PATH,
        "https://user@nvidianews.nvidia.com" + PATH,
        ORIGIN + "/news/../../private",
        "http://127.0.0.1:8000",
    ]:
        assert not allowed_url(url)


def test_cached_snapshot_does_not_refetch_and_expires(monkeypatch):
    monkeypatch.setattr("backend.disclosures.utc_now", lambda: NOW)
    model, calls = provider_for()
    try:
        first = model.snapshot()
        assert first.availability == "AVAILABLE"
        assert model.snapshot().cached and len(calls) == 2
        first.evidence.clear()
        assert model.snapshot().evidence  # callers cannot mutate the cache
        model._expires = 0
        model.snapshot()
        assert len(calls) == 4
    finally:
        model.close()


@pytest.mark.parametrize(
    "now,status",
    [
        (NOW, "AVAILABLE"),
        (NOW + timedelta(days=130), "STALE"),
        (datetime(2026, 8, 26, tzinfo=UTC), "UNAVAILABLE"),
    ],
)
def test_freshness_and_conservative_availability(monkeypatch, now, status):
    monkeypatch.setattr("backend.disclosures.utc_now", lambda: now)
    model, _ = provider_for()
    try:
        assert model.snapshot().availability == status
    finally:
        model.close()


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(302, headers={"location": "https://attacker.example"}),
        httpx.Response(200, text="x" * (MAX_BYTES + 1), headers={"content-type": "text/html"}),
        httpx.Response(200, text="not html", headers={"content-type": "application/json"}),
        httpx.Response(
            200, text="<html>layout changed</html>", headers={"content-type": "text/html"}
        ),
    ],
)
def test_retrieval_limits_and_redirects_fail_closed(response):
    calls = []

    def handler(request):
        calls.append(request)
        return response

    model = NvidiaDisclosureProvider(httpx.Client(transport=httpx.MockTransport(handler)))
    try:
        result = model.snapshot()
        assert result.availability == "UNAVAILABLE" and result.evidence == []
        assert len(calls) == 1
    finally:
        model.close()


def test_live_evidence_survives_refresh_stress_revision_restart_and_ai_review(
    tmp_path, thesis, monkeypatch
):
    from tests.test_llm import FakeLanguageModel

    monkeypatch.setattr("backend.disclosures.utc_now", lambda: NOW)
    monkeypatch.setattr("backend.routes.utc_now", lambda: NOW)
    provider, calls = provider_for()
    monkeypatch.setattr(
        "backend.api.CompanyDisclosureProvider",
        lambda: CompanyDisclosureProvider(nvidia=provider),
    )
    monkeypatch.setattr(
        "backend.providers.BitgetProvider.snapshot",
        lambda self, instrument_id="RNVDAUSDT": {"availability": "UNAVAILABLE"},
    )
    path = str(tmp_path / "public.sqlite3")
    with TestClient(create_app(path, llm=FakeLanguageModel())) as client:
        draft = client.post("/theses/draft", json=thesis.model_dump(mode="json")).json()
        base = f"/theses/{draft['id']}"
        client.post(base + "/confirm", json={**draft["thesis"], "expected_version": 1})
        first = client.post(base + "/refresh", json={})
        assert first.status_code == 200, first.text
        result = first.json()
        assert result["state"] == "INVALIDATED" and result["mode"] == "LIVE_REFRESH"
        evidence = result["evidence"][0]
        assert client.get("/evidence/" + evidence["id"]).json() == evidence
        reviewed = client.post(base + "/ai-review", json={})
        assert reviewed.status_code == 200, reviewed.text
        assert reviewed.json()["evidence"] == result["evidence"]
        assert client.post(base + "/stress", json={}).status_code == 200
        selected = client.get(base + "/assessments").json()["selected_assessment"]
        assert selected["evidence"] == result["evidence"]
        assert selected["disclosure_retrieval"] == result["disclosure_retrieval"]
        revision = client.post(
            base + "/revisions",
            json={
                **draft["thesis"],
                "expected_version": 2,
                "holding_days": 100,
                "explanation": "Reconsider the current report.",
                "evidence_ids": [evidence["id"]],
            },
        )
        assert revision.status_code == 200, revision.text
        selected = client.get(base + "/assessments").json()["selected_assessment"]
        assert selected["evidence"] == result["evidence"]
        assert len(calls) == 2
    with TestClient(create_app(path, llm=FakeLanguageModel())) as client:
        assert client.get("/evidence/" + evidence["id"]).json() == evidence
        assert client.get("/evidence/unknown-public-document").status_code == 404
