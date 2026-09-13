"""Bounded, cached public NVIDIA earnings discovery and retrieval."""

import re
import threading
import time
from datetime import datetime, timedelta
from typing import Literal
from urllib.parse import urljoin, urlsplit

import httpx

from backend.contracts import Contract, Evidence, utc_now
from backend.disclosure_parser import DisclosureHTML, parse_disclosure

ORIGIN = "https://nvidianews.nvidia.com"
INDEX_URL = ORIGIN + "/news?q=financial%20results"
RELEASE_PATH = re.compile(
    r"/news/nvidia-announces-financial-results-for-(first|second|third|fourth)-quarter-(?:and-)?fiscal-(20\d{2})"
)
MAX_BYTES = 2_000_000


class DisclosureSnapshot(Contract):
    availability: Literal["AVAILABLE", "PARTIAL", "STALE", "UNAVAILABLE"]
    checked_at: datetime
    source: str = INDEX_URL
    evidence: list[Evidence]
    warnings: list[str]
    cached: bool = False


def allowed_url(url: str) -> bool:
    parsed = urlsplit(url)
    return url == INDEX_URL or (
        parsed.scheme == "https"
        and parsed.netloc == "nvidianews.nvidia.com"
        and not parsed.query
        and not parsed.fragment
        and RELEASE_PATH.fullmatch(parsed.path) is not None
    )


def latest_release(html: str) -> str:
    candidates = {}
    for link in DisclosureHTML(html).root.find("a"):
        url = urljoin(ORIGIN, link.attrs.get("href") or "")
        if not allowed_url(url):
            continue
        match = RELEASE_PATH.fullmatch(urlsplit(url).path)
        if match:
            candidates[url] = (
                int(match[2]),
                {"first": 1, "second": 2, "third": 3, "fourth": 4}[match[1]],
            )
    if not candidates:
        raise ValueError("No supported earnings releases in the public listing")
    return max(candidates, key=candidates.__getitem__)


class NvidiaDisclosureProvider:
    def __init__(self, client: httpx.Client | None = None):
        self.client = client or httpx.Client(
            timeout=httpx.Timeout(10, connect=5), follow_redirects=False
        )
        self._lock = threading.Lock()
        self._cached: DisclosureSnapshot | None = None
        self._expires = 0.0

    def close(self):
        self.client.close()

    def _fetch(self, url: str, deadline: float) -> str:
        if not allowed_url(url):
            raise ValueError("Source URL is outside the approved NVIDIA paths")
        with self.client.stream(
            "GET", url, follow_redirects=False, headers={"Accept": "text/html"}
        ) as response:
            response.raise_for_status()
            if "text/html" not in response.headers.get("content-type", "").lower():
                raise ValueError("Expected an HTML disclosure")
            content = bytearray()
            for chunk in response.iter_bytes():
                content.extend(chunk)
                if len(content) > MAX_BYTES or time.monotonic() > deadline:
                    raise ValueError("Disclosure exceeded retrieval limits")
            return content.decode("utf-8", errors="strict")

    def snapshot(self) -> DisclosureSnapshot:
        with self._lock:
            if self._cached and time.monotonic() < self._expires:
                return self._cached.model_copy(update={"cached": True}, deep=True)
            now = utc_now()
            try:
                deadline = time.monotonic() + 25
                url = latest_release(self._fetch(INDEX_URL, deadline))
                html = self._fetch(url, deadline)
                now = utc_now()
                evidence = parse_disclosure(html, url, now)
                if evidence.available_at > now:
                    raise ValueError(
                        "Latest disclosure has not passed the day-level availability gate"
                    )
                warnings = []
                availability = "AVAILABLE"
                if now - evidence.available_at > timedelta(days=120):
                    availability = "STALE"
                    warnings.append(
                        "Latest discovered disclosure is older than the 120-day evidence window."
                    )
                elif len(evidence.metrics) < 2:
                    availability = "PARTIAL"
                    warnings.append(
                        "Some reported metrics could not be parsed unambiguously; affected assumptions abstain."
                    )
                result = DisclosureSnapshot(
                    availability=availability,
                    checked_at=now,
                    evidence=[evidence],
                    warnings=warnings,
                )
            except (httpx.HTTPError, ValueError, UnicodeError) as error:
                result = DisclosureSnapshot(
                    availability="UNAVAILABLE",
                    checked_at=now,
                    evidence=[],
                    warnings=[
                        f"NVIDIA disclosure retrieval unavailable ({type(error).__name__}); no older report substituted."
                    ],
                )
            self._cached = result
            self._expires = time.monotonic() + (30 if result.availability == "UNAVAILABLE" else 300)
            return result.model_copy(deep=True)
