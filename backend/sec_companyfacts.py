"""Bounded SEC company-facts retrieval for the allowlisted instrument registry."""

import hashlib
import json
import os
import re
import threading
import time
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

import httpx

from backend.contracts import Evidence, InstrumentId, utc_now
from backend.disclosures import DisclosureSnapshot
from backend.instruments import INSTRUMENTS, Instrument, instrument_by_id

ORIGIN = "https://data.sec.gov"
MAX_BYTES = 12_000_000
FRAME = re.compile(r"^CY(20\d{2})Q([1-4])$")
REVENUE_TAGS = (
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
)
GROSS_PROFIT_TAGS = ("GrossProfit",)


def companyfacts_url(instrument: Instrument) -> str:
    return f"{ORIGIN}/api/xbrl/companyfacts/CIK{instrument.issuer_cik}.json"


def allowed_url(url: str) -> bool:
    return any(url == companyfacts_url(item) for item in instrument_registry())


def instrument_registry() -> list[Instrument]:
    return list(INSTRUMENTS.values())


def _as_date(value: object) -> date | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _quarter_values(payload: dict, tags: tuple[str, ...], today: date) -> list[dict]:
    facts = payload.get("facts", {}).get("us-gaap", {})
    values = []
    for tag in tags:
        entries = facts.get(tag, {}).get("units", {}).get("USD", [])
        for item in entries if isinstance(entries, list) else []:
            frame = item.get("frame")
            start = _as_date(item.get("start"))
            end = _as_date(item.get("end"))
            filed = _as_date(item.get("filed"))
            if (
                not isinstance(frame, str)
                or FRAME.fullmatch(frame) is None
                or start is None
                or end is None
                or filed is None
                or filed > today
                or item.get("form") not in {"10-Q", "10-K"}
                or not 70 <= (end - start).days <= 105
            ):
                continue
            try:
                value = Decimal(str(item["val"]))
            except (KeyError, TypeError, ArithmeticError):
                continue
            if value.is_finite() and value > 0:
                values.append(
                    {
                        **item,
                        "_start": start,
                        "_end": end,
                        "_filed": filed,
                        "_value": value,
                        "_tag": tag,
                    }
                )
    return values


def _latest(values: list[dict]) -> dict | None:
    return max(values, key=lambda item: (item["_end"], item["_filed"]), default=None)


def _matching(values: list[dict], current: dict) -> dict | None:
    matching = [
        item
        for item in values
        if item.get("frame") == current.get("frame")
        and item["_start"] == current["_start"]
        and item["_end"] == current["_end"]
    ]
    return max(
        matching,
        key=lambda item: (item.get("accn") == current.get("accn"), item["_filed"]),
        default=None,
    )


def _prior(values: list[dict], current: dict) -> dict | None:
    match = FRAME.fullmatch(current["frame"])
    if match is None:
        return None
    prior_frame = f"CY{int(match[1]) - 1}Q{match[2]}"
    duration = (current["_end"] - current["_start"]).days
    candidates = [
        item
        for item in values
        if item.get("frame") == prior_frame
        and abs((item["_end"] - item["_start"]).days - duration) <= 7
    ]
    return max(candidates, key=lambda item: item["_filed"], default=None)


def parse_companyfacts(payload: dict, instrument: Instrument, now: datetime) -> Evidence:
    if str(payload.get("cik", "")).zfill(10) != instrument.issuer_cik:
        raise ValueError("SEC response CIK does not match the selected issuer")
    if payload.get("entityName") != instrument.issuer_name:
        raise ValueError("SEC response issuer name does not match the selected instrument")

    revenues = _quarter_values(payload, REVENUE_TAGS, now.date())
    current = _latest(revenues)
    if current is None:
        raise ValueError("No supported quarterly revenue fact")
    prior = _prior(revenues, current)
    gross = _matching(_quarter_values(payload, GROSS_PROFIT_TAGS, now.date()), current)

    metrics: dict[str, Decimal] = {}
    excerpt = [
        (
            f"Filed revenue for {current['frame']} was ${current['_value']:,} for "
            f"{current['_start'].isoformat()} through {current['_end'].isoformat()}."
        )
    ]
    if prior is not None:
        growth = ((current["_value"] - prior["_value"]) / prior["_value"] * 100).quantize(
            Decimal("0.1")
        )
        metrics["revenue_growth_yoy_pct"] = growth
        excerpt.append(
            f"The comparable prior-year revenue was ${prior['_value']:,}; derived year-over-year growth is {growth}%."
        )
    if gross is not None:
        margin = (gross["_value"] / current["_value"] * 100).quantize(Decimal("0.1"))
        metrics["gaap_margin_pct"] = margin
        excerpt.append(
            f"Filed gross profit was ${gross['_value']:,}; derived GAAP gross margin is {margin}%."
        )
    if not metrics:
        raise ValueError("No supported metric can be derived from aligned quarterly facts")

    filed_at = datetime.combine(current["_filed"], datetime.min.time(), UTC)
    available_at = filed_at + timedelta(days=1)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    document_hash = hashlib.sha256(canonical).hexdigest()
    identity = f"{instrument.id}:{current['frame']}:{current.get('accn', '')}:{document_hash}"
    return Evidence(
        id=f"sec-{instrument.ticker.lower()}-{hashlib.sha256(identity.encode()).hexdigest()}",
        instrument_id=instrument.id,
        publisher="U.S. Securities and Exchange Commission",
        source_url=companyfacts_url(instrument),
        title=f"{instrument.display_name} filed quarterly facts · {current['frame']}",
        excerpt=" ".join(excerpt),
        published_at=filed_at,
        available_at=available_at,
        observed_at=datetime.combine(current["_end"], datetime.min.time(), UTC),
        retrieved_at=now,
        content_hash=hashlib.sha256(" ".join(excerpt).encode()).hexdigest(),
        duplicate_family=f"{instrument.ticker}-{current['frame']}",
        scope=f"{instrument.issuer_name}; aligned quarterly SEC XBRL facts only",
        limitations=(
            "Revenue growth and gross margin are deterministic calculations from filed facts. "
            "The SEC feed is an official filing dataset, not an independent corroborating source. "
            "Token price, eligibility, backing and liquidity are not represented."
        ),
        metrics=metrics,
        origin="PUBLIC_RETRIEVAL",
        document_hash=document_hash,
        parser_version="sec-companyfacts-v1",
    )


class SecCompanyFactsProvider:
    def __init__(self, client: httpx.Client | None = None):
        user_agent = os.getenv(
            "REVISO_SEC_USER_AGENT", "Reviso research prototype contact@revisoagent.xyz"
        )
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(12, connect=5),
            follow_redirects=False,
            headers={"Accept": "application/json", "User-Agent": user_agent},
        )
        self._lock = threading.Lock()
        self._cache: dict[InstrumentId, tuple[DisclosureSnapshot, float]] = {}

    def close(self):
        self.client.close()

    def _fetch(self, url: str) -> dict:
        if not allowed_url(url):
            raise ValueError("SEC source URL is outside the instrument allowlist")
        with self.client.stream("GET", url, follow_redirects=False) as response:
            response.raise_for_status()
            if "application/json" not in response.headers.get("content-type", "").lower():
                raise ValueError("Expected SEC JSON company facts")
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > MAX_BYTES:
                    raise ValueError("SEC company facts exceeded the size limit")
        return json.loads(content)

    def snapshot(self, instrument_id: InstrumentId) -> DisclosureSnapshot:
        with self._lock:
            cached = self._cache.get(instrument_id)
            if cached and time.monotonic() < cached[1]:
                return cached[0].model_copy(update={"cached": True}, deep=True)
            now = utc_now()
            instrument = instrument_by_id(instrument_id)
            source = companyfacts_url(instrument)
            try:
                evidence = parse_companyfacts(self._fetch(source), instrument, now)
                age = now - evidence.available_at
                warnings: list[str] = []
                availability = "AVAILABLE"
                if age > timedelta(days=120):
                    availability = "STALE"
                    warnings.append(
                        "Latest aligned quarterly filing is older than the 120-day evidence window."
                    )
                elif not {
                    metric for metric in instrument.supported_metrics if metric != "manual"
                }.issubset(evidence.metrics):
                    availability = "PARTIAL"
                    warnings.append(
                        "Only some supported metrics were available in aligned filed facts; other assumptions abstain."
                    )
                result = DisclosureSnapshot(
                    availability=availability,
                    checked_at=now,
                    source=source,
                    evidence=[evidence],
                    warnings=warnings,
                )
            except (httpx.HTTPError, ValueError, UnicodeError, json.JSONDecodeError) as error:
                result = DisclosureSnapshot(
                    availability="UNAVAILABLE",
                    checked_at=now,
                    source=source,
                    evidence=[],
                    warnings=[
                        f"SEC company-facts retrieval unavailable ({type(error).__name__}); no older report substituted."
                    ],
                )
            ttl = 30 if result.availability == "UNAVAILABLE" else 300
            self._cache[instrument_id] = (result, time.monotonic() + ttl)
            return result.model_copy(deep=True)
