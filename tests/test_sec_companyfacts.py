from datetime import UTC, datetime
from decimal import Decimal

import httpx
import pytest

from backend.company_disclosures import CompanyDisclosureProvider
from backend.disclosures import DisclosureSnapshot
from backend.instruments import ALPHABET, AMAZON, APPLE, MICROSOFT, TESLA
from backend.sec_companyfacts import SecCompanyFactsProvider, allowed_url, parse_companyfacts

NOW = datetime(2026, 9, 12, tzinfo=UTC)


def companyfacts(
    *,
    cik: str,
    entity_name: str,
    current_frame: str = "CY2026Q2",
    current_start: str = "2026-03-29",
    current_end: str = "2026-06-27",
    current_filed: str = "2026-07-31",
    current_revenue: int = 94_000,
    prior_frame: str = "CY2025Q2",
    prior_start: str = "2025-03-30",
    prior_end: str = "2025-06-28",
    prior_revenue: int = 80_000,
    gross_profit: int | None = 47_000,
) -> dict:
    current = {
        "start": current_start,
        "end": current_end,
        "filed": current_filed,
        "frame": current_frame,
        "form": "10-Q",
        "accn": "current",
        "val": current_revenue,
    }
    prior = {
        "start": prior_start,
        "end": prior_end,
        "filed": "2025-08-01",
        "frame": prior_frame,
        "form": "10-Q",
        "accn": "prior",
        "val": prior_revenue,
    }
    facts = {
        "RevenueFromContractWithCustomerExcludingAssessedTax": {"units": {"USD": [prior, current]}}
    }
    if gross_profit is not None:
        facts["GrossProfit"] = {"units": {"USD": [{**current, "val": gross_profit}]}}
    return {
        "cik": int(cik),
        "entityName": entity_name,
        "facts": {"us-gaap": facts},
    }


@pytest.mark.parametrize("instrument", [APPLE, MICROSOFT, ALPHABET, AMAZON, TESLA])
def test_allowlisted_issuers_produce_bound_quarterly_metrics(instrument):
    evidence = parse_companyfacts(
        companyfacts(cik=instrument.issuer_cik, entity_name=instrument.issuer_name),
        instrument,
        NOW,
    )
    assert evidence.instrument_id == instrument.id
    assert evidence.metrics == {
        "revenue_growth_yoy_pct": Decimal("17.5"),
        "gaap_margin_pct": Decimal("50.0"),
    }
    assert instrument.issuer_name in evidence.scope
    assert evidence.origin == "PUBLIC_RETRIEVAL"
    assert evidence.available_at == datetime(2026, 8, 1, tzinfo=UTC)


def test_every_supported_companyfacts_url_is_allowlisted():
    for instrument in (APPLE, MICROSOFT, ALPHABET, AMAZON, TESLA):
        assert allowed_url(instrument.evidence_source)


def test_wrong_issuer_identity_and_unaligned_values_fail_closed():
    wrong = companyfacts(cik=APPLE.issuer_cik, entity_name="Attacker Corp")
    with pytest.raises(ValueError, match="issuer name"):
        parse_companyfacts(wrong, APPLE, NOW)

    malformed = companyfacts(cik=APPLE.issuer_cik, entity_name=APPLE.issuer_name)
    malformed["facts"]["us-gaap"]["RevenueFromContractWithCustomerExcludingAssessedTax"]["units"][
        "USD"
    ][-1]["val"] = None
    with pytest.raises(ValueError, match="No supported metric"):
        parse_companyfacts(malformed, APPLE, NOW)


def test_newer_revenue_taxonomy_is_used_when_the_preferred_tag_is_old():
    payload = companyfacts(cik=ALPHABET.issuer_cik, entity_name=ALPHABET.issuer_name)
    facts = payload["facts"]["us-gaap"]
    old = facts.pop("RevenueFromContractWithCustomerExcludingAssessedTax")
    facts["RevenueFromContractWithCustomerExcludingAssessedTax"] = {
        "units": {"USD": [{**old["units"]["USD"][0], "frame": "CY2024Q2"}]}
    }
    facts["Revenues"] = old

    evidence = parse_companyfacts(payload, ALPHABET, NOW)

    assert "CY2026Q2" in evidence.title
    assert evidence.metrics["revenue_growth_yoy_pct"] == Decimal("17.5")


def test_partial_and_stale_provider_states_remain_explicit(monkeypatch):
    payloads = [
        companyfacts(
            cik=APPLE.issuer_cik,
            entity_name=APPLE.issuer_name,
            gross_profit=None,
        ),
        companyfacts(
            cik=APPLE.issuer_cik,
            entity_name=APPLE.issuer_name,
            current_frame="CY2025Q4",
            current_start="2025-09-28",
            current_end="2025-12-27",
            current_filed="2026-01-30",
            prior_frame="CY2024Q4",
            prior_start="2024-09-29",
            prior_end="2024-12-28",
        ),
    ]
    monkeypatch.setattr("backend.sec_companyfacts.utc_now", lambda: NOW)

    for expected, payload in zip(("PARTIAL", "STALE"), payloads, strict=True):
        provider = SecCompanyFactsProvider(
            httpx.Client(
                transport=httpx.MockTransport(
                    lambda _request, body=payload: httpx.Response(
                        200,
                        json=body,
                        headers={"content-type": "application/json"},
                    )
                )
            )
        )
        try:
            result = provider.snapshot("RAAPLUSDT")
            assert result.availability == expected
            assert result.evidence[0].instrument_id == "RAAPLUSDT"
            assert result.warnings
        finally:
            provider.close()


def test_single_declared_numerical_metric_is_complete(monkeypatch):
    payload = companyfacts(
        cik=AMAZON.issuer_cik,
        entity_name=AMAZON.issuer_name,
        gross_profit=None,
    )
    monkeypatch.setattr("backend.sec_companyfacts.utc_now", lambda: NOW)
    provider = SecCompanyFactsProvider(
        httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(
                    200,
                    json=payload,
                    headers={"content-type": "application/json"},
                )
            )
        )
    )
    try:
        assert provider.snapshot("RAMZNUSDT").availability == "AVAILABLE"
    finally:
        provider.close()


class StubProvider:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def snapshot(self, instrument_id=None):
        self.calls.append(instrument_id)
        return self.result

    def close(self):
        pass


def test_nvidia_sec_recovery_is_labeled_as_redundancy():
    primary = StubProvider(
        DisclosureSnapshot(
            availability="UNAVAILABLE",
            checked_at=NOW,
            evidence=[],
            warnings=["Primary unavailable"],
        )
    )
    recovery = StubProvider(
        DisclosureSnapshot(
            availability="AVAILABLE",
            checked_at=NOW,
            source="https://data.sec.gov/example",
            evidence=[],
            warnings=[],
        )
    )
    provider = CompanyDisclosureProvider(nvidia=primary, sec=recovery)
    result = provider.snapshot("RNVDAUSDT")
    assert primary.calls == [None]
    assert recovery.calls == ["RNVDAUSDT"]
    assert "retrieval redundancy, not independent corroboration" in " ".join(result.warnings)
