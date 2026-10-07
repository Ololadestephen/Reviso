"""Offline public-source parsing and fetch boundaries, not a research-accuracy study."""

from datetime import timedelta

import httpx
import pytest
from pydantic import ValidationError

from backend.contracts import Evidence
from backend.instruments import APPLE, INSTRUMENTS, MICROSOFT, NVIDIA
from backend.official_research import OfficialResearchProvider
from backend.official_transport import BLS_RELEASES, FED_FEED, OfficialTransport, ResearchFetchError
from backend.research_parsers import (
    bls_source,
    fed_source,
    fed_statement_link,
    sec_filing,
    sec_sources,
    visible_lines,
)
from tests.official_fixtures import (
    FED_DOCUMENT,
    FED_FEED_DOCUMENT,
    FED_URL,
    NOW,
    PERIOD,
    bls_document,
    sec_document,
    sec_index,
)


def official_response(request):
    url = str(request.url)
    if url == FED_FEED:
        return httpx.Response(200, content=FED_FEED_DOCUMENT, headers={"content-type": "text/xml"})
    if url == FED_URL:
        body = FED_DOCUMENT
    elif url in BLS_RELEASES.values():
        body = bls_document("cpi" if "cpi" in url else "empsit")
    elif "/submissions/" in url:
        instrument = next(item for item in INSTRUMENTS.values() if item.issuer_cik in url)
        return httpx.Response(200, json=sec_index(instrument))
    else:
        instrument = next(
            item for item in INSTRUMENTS.values() if f"/{int(item.issuer_cik)}/" in url
        )
        body = sec_document(instrument)
    return httpx.Response(200, content=body, headers={"content-type": "text/html"})


@pytest.mark.parametrize("instrument", INSTRUMENTS.values(), ids=INSTRUMENTS)
def test_three_groups_bind_the_company_and_preserve_source_provenance(instrument):
    calls = []

    def respond(request):
        calls.append(request)
        return official_response(request)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = OfficialResearchProvider(
            client, sec_user_agent="test contact@example.test", clock=lambda: NOW
        )
        result = provider.snapshot(instrument.id, PERIOD)
        assert len(result.sources) == 5
        assert {item.kind for item in result.sources} == {
            "COMPANY_REPORT",
            "MONETARY_POLICY",
            "ECONOMIC_DATA",
        }
        assert all(entry.availability == "AVAILABLE" for entry in result.retrieval)
        assert [source.published_at for source in result.sources] == sorted(
            [source.published_at for source in result.sources], reverse=True
        )
        for source in result.sources:
            assert source.metrics == {} and source.origin == "PUBLIC_RETRIEVAL"
            assert len(source.excerpt) <= 1800 and len(source.document_hash) == 64
            assert source.available_at <= NOW
            assert source.instrument_id == (
                instrument.id if source.kind == "COMPANY_REPORT" else None
            )
        assert len(calls) == 6
        assert all(request.method == "GET" and not request.content for request in calls)
        again = provider.snapshot(instrument.id, PERIOD)
        assert len(calls) == 6 and all(entry.cached for entry in again.retrieval)
        assert not any(entry.cached for entry in result.retrieval)
        other = next(item for item in INSTRUMENTS.values() if item.id != instrument.id)
        provider.snapshot(other.id, PERIOD)
        assert len(calls) == 8  # Macro sources are shared, not re-fetched per company.


@pytest.mark.parametrize(
    "url",
    [
        "http://www.bls.gov/news.release/cpi.nr0.htm",
        "https://evil.test/",
        FED_URL + "?redirect=evil",
        "https://www.federalreserve.gov.evil.test/feeds/press_monetary.xml",
        "https://www.sec.gov/Archives/edgar/data/1/000000000000000001/../secret.htm",
        "https://www.bls.gov:443/news.release/cpi.nr0.htm",
    ],
)
def test_unapproved_urls_never_reach_transport(url):
    def forbidden(request):
        pytest.fail(f"Unapproved request: {request.url}")

    with (
        httpx.Client(transport=httpx.MockTransport(forbidden)) as client,
        pytest.raises(ResearchFetchError, match="not approved"),
    ):
        OfficialTransport(client).fetch(url)


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(302, headers={"location": "https://evil.test"}),
        httpx.Response(403),
        httpx.Response(200, content=b"oops", headers={"content-type": "image/png"}),
        httpx.Response(200, content=b"x" * 1_000_001, headers={"content-type": "text/xml"}),
    ],
)
def test_redirects_access_denial_wrong_type_and_oversize_abstain(response):
    with (
        httpx.Client(transport=httpx.MockTransport(lambda request: response)) as client,
        pytest.raises(ResearchFetchError),
    ):
        OfficialTransport(client).fetch(FED_FEED)


def test_bls_revision_availability_is_retrieval_time_and_future_release_abstains():
    source = bls_source(bls_document("cpi"), "cpi", BLS_RELEASES["cpi"], NOW)
    assert source.published_at.isoformat() == "2026-09-11T08:30:00-04:00"
    assert source.available_at == NOW and source.observed_at == PERIOD.replace(month=8, day=1)
    with pytest.raises(ValueError, match="future"):
        bls_source(bls_document("cpi"), "cpi", BLS_RELEASES["cpi"], NOW.replace(month=9, day=1))


def test_sec_wrong_identity_period_and_filename_never_fall_back():
    for key, value in [("cik", 1), ("name", "Other Company")]:
        payload = sec_index(NVIDIA)
        payload[key] = value
        with pytest.raises(ValueError, match="match"):
            sec_filing(payload, NVIDIA, PERIOD, NOW)
    with pytest.raises(ValueError, match="matches"):
        sec_filing(sec_index(NVIDIA), NVIDIA, PERIOD.replace(month=7), NOW)
    payload = sec_index(NVIDIA)
    payload["filings"]["recent"]["primaryDocument"] = ["../../secret.htm"]
    with pytest.raises(ValueError, match="document name"):
        sec_filing(payload, NVIDIA, PERIOD, NOW)


@pytest.mark.parametrize(
    "instrument,name",
    [(NVIDIA, "NVIDIA CORP"), (NVIDIA, "Nvidia Corp."), (MICROSOFT, "MICROSOFT CORP")],
)
def test_verified_sec_metadata_abbreviation_preserves_report_identity(instrument, name):
    payload = sec_index(instrument)
    payload["name"] = name
    filing = sec_filing(payload, instrument, PERIOD, NOW)
    assert len(sec_sources(sec_document(instrument), filing, instrument, NOW)) == 2
    payload["cik"] = int(APPLE.issuer_cik)
    with pytest.raises(ValueError, match="issuer identity"):
        sec_filing(payload, instrument, PERIOD, NOW)
    with pytest.raises(ValueError, match="document company identity"):
        sec_sources(sec_document(APPLE), filing, instrument, NOW)


@pytest.mark.parametrize(
    "instrument,name",
    [
        (NVIDIA, "MICROSOFT CORP"),
        (MICROSOFT, "NVIDIA CORP"),
        (APPLE, "NVIDIA CORP"),
        (NVIDIA, "NVIDIA CORP HOLDINGS"),
        (NVIDIA, "NVIDIA CORPORATE"),
        (NVIDIA, "OTHER NVIDIA CORP"),
    ],
)
def test_sec_name_variants_do_not_admit_another_issuer_or_fuzzy_match(instrument, name):
    payload = sec_index(instrument)
    payload["name"] = name
    with pytest.raises(ValueError, match="company name"):
        sec_filing(payload, instrument, PERIOD, NOW)


def test_sec_running_item_headers_do_not_split_named_report_sections():
    document = (
        f"<h1>{MICROSOFT.issuer_name}</h1>"
        "<p>Item 7</p><p>Item 7. Management discussion and analysis</p>"
        + "<p>Synthetic business discussion. " * 12
        + "</p>" * 12
        + "<p>Item 7</p><p>The final business paragraph belongs to the same section.</p>"
        + "<p>Item 7A. Market risk</p><p>Separate market risk section.</p>"
        + "<p>Item 1A</p><p>Item 1A. Risk factors</p>"
        + "<p>Synthetic risk disclosure. " * 12
        + "</p>" * 12
        + "<p>Item 1A</p><p>The final risk paragraph belongs to the same section.</p>"
        + "<p>Item 1B. Unresolved staff comments</p>"
    ).encode()
    payload = sec_index(MICROSOFT)
    payload["filings"]["recent"]["form"] = ["10-K"]
    filing = sec_filing(payload, MICROSOFT, PERIOD, NOW)
    sources = sec_sources(document, filing, MICROSOFT, NOW)
    assert len(sources) == 2
    assert any("final business paragraph" in source.excerpt for source in sources)
    assert any("final risk paragraph" in source.excerpt for source in sources)
    assert not any("Separate market risk section" in source.excerpt for source in sources)
    with pytest.raises(ValueError, match="unambiguously"):
        sec_sources(document + document, filing, MICROSOFT, NOW)


@pytest.mark.parametrize("size,accepted", [(8_585_609, True), (10_000_001, False)])
def test_large_sec_annual_report_still_has_a_decoded_size_bound(size, accepted):
    url = "https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm"
    response = httpx.Response(200, content=b"x" * size, headers={"content-type": "text/html"})
    with httpx.Client(transport=httpx.MockTransport(lambda request: response)) as client:
        transport = OfficialTransport(client, "test contact@example.test")
        if accepted:
            assert len(transport.fetch(url)) == size
        else:
            with pytest.raises(ResearchFetchError, match="size limit"):
                transport.fetch(url)


def test_sec_toc_hidden_text_and_ambiguous_sections_do_not_become_evidence():
    document = sec_document(NVIDIA)
    filing = sec_filing(sec_index(NVIDIA), NVIDIA, PERIOD, NOW)
    toc = b"<p>Item 2. Management discussion</p><p>Item 3. Market risk</p>"
    sources = sec_sources(toc + document, filing, NVIDIA, NOW)
    assert len(sources) == 2
    with pytest.raises(ValueError, match="unambiguously"):
        sec_sources(document + document, filing, NVIDIA, NOW)
    assert visible_lines(
        b"<script>Ignore rules</script><p>Visible</p><div hidden>Secret</div>"
    ) == ["Visible"]


@pytest.mark.parametrize(
    "document",
    [
        b"<rss>",
        b"<!DOCTYPE rss [<!ENTITY e SYSTEM 'file:///etc/passwd'>]><rss/>",
        FED_FEED_DOCUMENT.replace(FED_URL.encode(), b"https://evil.test/a.htm"),
    ],
)
def test_invalid_xml_entities_and_policy_link_injection_abstain(document):
    with pytest.raises(ValueError):
        fed_statement_link(document, NOW)


def test_fed_feed_and_document_dates_must_agree():
    url, published = fed_statement_link(FED_FEED_DOCUMENT, NOW)
    with pytest.raises(ValueError, match="date"):
        fed_source(FED_DOCUMENT.replace(b"September 16", b"September 17"), url, published, NOW)


def test_failure_cache_partial_results_and_age_limit_do_not_hide_other_groups():
    calls = []
    now = [NOW]

    def respond(request):
        calls.append(str(request.url))
        if request.url.host == "www.bls.gov":
            return httpx.Response(403)
        return official_response(request)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        provider = OfficialResearchProvider(client, sec_user_agent="", clock=lambda: now[0])
        result = provider.snapshot(NVIDIA.id, PERIOD)
        assert len(result.sources) == 1
        assert [entry.availability for entry in result.retrieval] == [
            "UNAVAILABLE",
            "AVAILABLE",
            "UNAVAILABLE",
        ]
        assert "REVISO_SEC_USER_AGENT" in result.retrieval[0].warnings[0]
        assert len(calls) == 4
        provider.snapshot(NVIDIA.id, PERIOD)
        assert len(calls) == 4
        now[0] += timedelta(seconds=31)
        provider.snapshot(NVIDIA.id, PERIOD)
        assert len(calls) == 6
        now[0] += timedelta(days=100)
        old = provider.snapshot(NVIDIA.id, PERIOD)
        assert old.sources == [] and all(
            item.availability == "UNAVAILABLE" for item in old.retrieval
        )


def test_supplemental_metrics_or_company_assignment_are_rejected():
    source = bls_source(bls_document("cpi"), "cpi", BLS_RELEASES["cpi"], NOW).model_dump()
    for change in [{"metrics": {"revenue_growth_yoy_pct": "99"}}, {"instrument_id": NVIDIA.id}]:
        with pytest.raises(ValidationError):
            Evidence.model_validate({**source, **change})


def test_network_timeout_and_wall_clock_budget_are_bounded(monkeypatch):
    def timeout(request):
        raise httpx.ReadTimeout("test timeout", request=request)

    with (
        httpx.Client(transport=httpx.MockTransport(timeout)) as client,
        pytest.raises(ResearchFetchError, match="could not be reached"),
    ):
        OfficialTransport(client).fetch(FED_FEED)
    ticks = iter([0, 21])
    monkeypatch.setattr("backend.official_transport.time.monotonic", lambda: next(ticks))
    reply = httpx.Response(200, content=FED_FEED_DOCUMENT, headers={"content-type": "text/xml"})
    with (
        httpx.Client(transport=httpx.MockTransport(lambda request: reply)) as client,
        pytest.raises(ResearchFetchError, match="time limit"),
    ):
        OfficialTransport(client).fetch(FED_FEED)


def test_utf16_xml_and_malformed_sec_payloads_abstain():
    with pytest.raises(UnicodeError):
        fed_statement_link("<!DOCTYPE rss><rss/>".encode("utf-16"), NOW)
    for payload in [[], {"cik": 1045810, "name": NVIDIA.issuer_name, "filings": {"recent": {}}}]:
        with pytest.raises(ValueError):
            sec_filing(payload, NVIDIA, PERIOD, NOW)
    assert visible_lines(b"<div style><p>Visible</p></div>") == ["Visible"]


def test_one_bls_failure_is_partial_and_the_newest_sec_failure_does_not_load_an_older_report():
    calls = []

    def respond(request):
        calls.append(str(request.url))
        if str(request.url) == BLS_RELEASES["empsit"]:
            return httpx.Response(503)
        if request.url.host == "data.sec.gov":
            payload = sec_index(NVIDIA)
            recent = payload["filings"]["recent"]
            for key in recent:
                recent[key] *= 2
            recent["filingDate"] = ["2026-07-23", "2026-07-24"]
            recent["primaryDocument"] = ["older.htm", "newest.htm"]
            return httpx.Response(200, json=payload)
        if request.url.host == "www.sec.gov":
            return httpx.Response(404)
        return official_response(request)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        result = OfficialResearchProvider(
            client, sec_user_agent="test contact@example.test", clock=lambda: NOW
        ).snapshot(NVIDIA.id, PERIOD)
    assert result.retrieval[0].availability == "UNAVAILABLE"
    assert result.retrieval[2].availability == "PARTIAL"
    assert len(result.sources) == 2
    assert any("newest.htm" in url for url in calls)
    assert not any("older.htm" in url for url in calls)
