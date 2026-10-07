"""Bounded HTTP access to fixed official research endpoints; never arbitrary URLs."""

import re
import time
from urllib.parse import urlsplit

import httpx

FED_FEED = "https://www.federalreserve.gov/feeds/press_monetary.xml"
BLS_RELEASES = {
    "cpi": "https://www.bls.gov/news.release/cpi.nr0.htm",
    "empsit": "https://www.bls.gov/news.release/empsit.nr0.htm",
}


def allowed_research_url(url: str) -> bool:
    parsed = urlsplit(url)
    if parsed.scheme != "https" or parsed.query or parsed.fragment or parsed.username:
        return False
    if url in {FED_FEED, *BLS_RELEASES.values()}:
        return True
    rules = {
        "data.sec.gov": r"/submissions/CIK[0-9]{10}\.json",
        "www.sec.gov": r"/Archives/edgar/data/[0-9]{1,10}/[0-9]{18}/[A-Za-z0-9_-]+\.html?",
        "www.federalreserve.gov": r"/newsevents/pressreleases/monetary[0-9]{8}a\.htm",
    }
    return bool(re.fullmatch(rules.get(parsed.netloc, r"(?!)"), parsed.path))


class ResearchFetchError(ValueError):
    """Safe public failure details, with no request content or credentials."""


def validate_response(response: httpx.Response, json_document: bool) -> None:
    if response.status_code != 200:
        raise ResearchFetchError(f"Official source returned HTTP {response.status_code}")
    content_type = response.headers.get("content-type", "").split(";")[0].lower()
    allowed = (
        {"application/json"}
        if json_document
        else {"text/html", "application/xhtml+xml", "text/xml", "application/xml"}
    )
    if content_type not in allowed:
        raise ResearchFetchError("Official source returned an unexpected document type")


def bounded_body(response: httpx.Response, limit: int, deadline: float) -> bytes:
    chunks: list[bytes] = []
    size = 0
    for chunk in response.iter_bytes():
        size += len(chunk)
        if size > limit:
            raise ResearchFetchError("Official document exceeded the size limit")
        if time.monotonic() > deadline:
            raise ResearchFetchError("Official document exceeded the time limit")
        chunks.append(chunk)
    return b"".join(chunks)


class OfficialTransport:
    def __init__(self, client: httpx.Client | None = None, sec_user_agent: str = ""):
        self.client = client or httpx.Client(timeout=httpx.Timeout(8, connect=5))
        self.owns_client = client is None
        self.sec_user_agent = sec_user_agent

    def close(self) -> None:
        if self.owns_client:
            self.client.close()

    def fetch(self, url: str, *, json_document: bool = False) -> bytes:
        if not allowed_research_url(url):
            raise ResearchFetchError("Source URL is not approved")
        sec = urlsplit(url).netloc in {"data.sec.gov", "www.sec.gov"}
        if sec and not self.sec_user_agent:
            raise ResearchFetchError("SEC requires REVISO_SEC_USER_AGENT with a real contact")
        headers = {
            "User-Agent": self.sec_user_agent if sec else "Reviso/1.0 (+https://revisoagent.xyz)"
        }
        limit = 10_000_000 if urlsplit(url).netloc == "www.sec.gov" else 1_000_000
        deadline = time.monotonic() + 20
        try:
            with self.client.stream(
                "GET", url, headers=headers, follow_redirects=False
            ) as response:
                validate_response(response, json_document)
                return bounded_body(response, limit, deadline)
        except httpx.HTTPError as error:
            raise ResearchFetchError("Official source could not be reached") from error
