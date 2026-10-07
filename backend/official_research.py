"""Cached public supplemental research; no private ideas leave this provider."""

import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Lock

import httpx

from backend.contracts import Evidence, InstrumentId, ResearchRetrieval, ResearchSources, utc_now
from backend.instruments import instrument_by_id
from backend.official_transport import BLS_RELEASES, FED_FEED, OfficialTransport
from backend.research_parsers import (
    bls_source,
    fed_source,
    fed_statement_link,
    sec_filing,
    sec_sources,
)


class OfficialResearchProvider:
    def __init__(
        self,
        client: httpx.Client | None = None,
        *,
        sec_user_agent: str | None = None,
        clock=utc_now,
    ):
        agent = (
            sec_user_agent if sec_user_agent is not None else os.getenv("REVISO_SEC_USER_AGENT", "")
        )
        self.transport = OfficialTransport(client, agent)
        self.clock = clock
        self.lock = Lock()
        self.cache: dict[str, tuple[datetime, ResearchSources]] = {}

    def close(self) -> None:
        self.transport.close()

    def snapshot(self, instrument_id: InstrumentId, period: datetime | None) -> ResearchSources:
        instrument = instrument_by_id(instrument_id)
        now = self.clock()
        sec_key = f"SEC:{instrument_id}:{period.date() if period else 'latest'}"
        # Serialize cache updates and coalesce concurrent button presses. Macro caches
        # are shared across issuers; no user or thesis content enters these keys.
        with self.lock:
            self.cache = {key: value for key, value in self.cache.items() if value[0] > now}
            if len(self.cache) > 64:
                self.cache = dict(sorted(self.cache.items(), key=lambda entry: entry[1][0])[-64:])
            jobs = [
                (sec_key, "SEC", lambda: self._sec(instrument, period, now)),
                ("FED", "FED", lambda: self._fed(now)),
                ("BLS", "BLS", lambda: self._bls(now)),
            ]
            with ThreadPoolExecutor(max_workers=3) as pool:
                results = list(pool.map(lambda job: self._cached(*job, now), jobs))
        return ResearchSources(
            sources=sorted(
                [source for result in results for source in result.sources],
                key=lambda source: source.published_at,
                reverse=True,
            ),
            retrieval=[entry for result in results for entry in result.retrieval],
        )

    def _cached(self, key, provider, load, now):
        previous = self.cache.get(key)
        if previous and previous[0] > now:
            copy = previous[1].model_copy(deep=True)
            for entry in copy.retrieval:
                entry.cached = True
            return copy
        warnings = []
        try:
            sources, warnings = load()
            age = timedelta(days=120 if provider == "SEC" else 62)
            current = [source for source in sources if now - source.published_at <= age]
            if len(current) != len(sources):
                warnings.append(
                    "Older material was not included; open the official site for its archive"
                )
            sources = current
        except (ValueError, KeyError, TypeError, UnicodeError) as error:
            sources = []
            # Parser errors describe public formats, never user inputs or secret headers.
            warnings = [
                str(error) if isinstance(error, ValueError) else "Official document format changed"
            ]
        availability = (
            "PARTIAL" if sources and warnings else "AVAILABLE" if sources else "UNAVAILABLE"
        )
        result = ResearchSources(
            sources=sources,
            retrieval=[
                ResearchRetrieval(
                    provider=provider, availability=availability, checked_at=now, warnings=warnings
                )
            ],
        )
        self.cache[key] = (now + timedelta(seconds=900 if sources else 30), result)
        return result

    def _sec(self, instrument, period, now):
        url = f"https://data.sec.gov/submissions/CIK{instrument.issuer_cik}.json"
        payload = json.loads(self.transport.fetch(url, json_document=True))
        filing = sec_filing(payload, instrument, period, now)
        document = self.transport.fetch(filing["url"])
        sources = sec_sources(document, filing, instrument, now)
        warnings = [] if len(sources) == 2 else ["Only one supported report section was identified"]
        return sources, warnings

    def _fed(self, now):
        url, published = fed_statement_link(self.transport.fetch(FED_FEED), now)
        return [fed_source(self.transport.fetch(url), url, published, now)], []

    def _bls(self, now):
        sources, warnings = [], []
        for release, url in BLS_RELEASES.items():
            try:
                sources.append(bls_source(self.transport.fetch(url), release, url, now))
            except (ValueError, UnicodeError) as error:
                warnings.append(f"{release.upper()}: {error}")
        return sources, warnings


def research_evidence(check: dict) -> list[Evidence]:
    """The AI citation set is wider than the numerical engine's filing set."""
    return [
        Evidence.model_validate(item)
        for item in [*check.get("evidence", []), *check.get("research_sources", [])]
    ]
