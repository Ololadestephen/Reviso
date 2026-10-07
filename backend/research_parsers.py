"""Selected official passages, with source identity and publication boundaries."""

import hashlib
import re
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
from typing import ClassVar, TypedDict
from zoneinfo import ZoneInfo

from defusedxml import ElementTree as ET
from defusedxml.common import DefusedXmlException
from pydantic import BaseModel

from backend.contracts import Evidence
from backend.instruments import Instrument
from backend.official_transport import allowed_research_url

PARSER_VERSION = "official-passages-v2"
EXCERPT_LIMIT = 1800
MAX_SEC_ROWS = 2000
# Verified against each issuer's SEC submissions index on 4 October 2026.
# These metadata abbreviations are scoped by CIK, not a global suffix rewrite.
SEC_INDEX_NAME_VARIANTS: dict[str, tuple[str, ...]] = {
    "0001045810": ("NVIDIA CORP",),
    "0000789019": ("MICROSOFT CORP",),
}


class SecFiling(TypedDict):
    url: str
    published: datetime
    observed: datetime
    form: str


class SecRecent(BaseModel):
    form: list[str]
    filingDate: list[str]
    reportDate: list[str]
    accessionNumber: list[str]
    primaryDocument: list[str]

    def rows(self) -> list[tuple[str, str, str, str, str]]:
        columns = [
            self.form,
            self.filingDate,
            self.reportDate,
            self.accessionNumber,
            self.primaryDocument,
        ]
        if len(self.form) > MAX_SEC_ROWS or any(
            len(column) != len(self.form) for column in columns
        ):
            raise ValueError("SEC filing index arrays differ or exceed the row limit")
        return list(zip(*columns, strict=True))


class SecFilings(BaseModel):
    recent: SecRecent


class SecIndex(BaseModel):
    cik: str | int
    name: str
    filings: SecFilings


def normalized_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


class VisibleLines(HTMLParser):
    """Discard executable/hidden content and preserve block boundaries."""

    blocks: ClassVar = {"p", "div", "h1", "h2", "h3", "h4", "li", "tr", "pre", "section", "br"}
    voids: ClassVar = {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "source",
        "wbr",
    }

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.stack: list[tuple[str, bool]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        hidden = (self.stack and self.stack[-1][1]) or tag in {"script", "style", "noscript", "nav"}
        hidden = bool(
            hidden
            or "hidden" in attributes
            or attributes.get("aria-hidden") == "true"
            or tag == "ix:hidden"
            or re.search(r"display\s*:\s*none", attributes.get("style") or "", re.IGNORECASE)
        )
        if len(self.stack) >= 200:
            raise ValueError("Document nesting exceeds the parser limit")
        if tag not in self.voids:
            self.stack.append((tag, hidden))
        if not hidden and tag in self.blocks:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.blocks and not (self.stack and self.stack[-1][1]):
            self.parts.append("\n")
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if not self.stack or not self.stack[-1][1]:
            self.parts.append(data)


def visible_lines(document: bytes) -> list[str]:
    parser = VisibleLines()
    parser.feed(document.decode("utf-8-sig", errors="strict"))
    return [line for text in "".join(parser.parts).splitlines() if (line := " ".join(text.split()))]


def dated_source(
    *,
    kind,
    instrument_id,
    url,
    publisher,
    title,
    excerpt,
    published,
    retrieved,
    document,
    observed=None,
    revisable=False,
    limitations="",
) -> Evidence:
    if published.tzinfo is None or published > retrieved:
        raise ValueError("Publication date is missing or in the future")
    excerpt = excerpt[:EXCERPT_LIMIT]
    content_hash = hashlib.sha256(excerpt.encode()).hexdigest()
    identity = hashlib.sha256(f"{url}|{published.isoformat()}|{content_hash}".encode()).hexdigest()
    return Evidence(
        id=f"research-{identity}",
        instrument_id=instrument_id,
        kind=kind,
        source_url=url,
        publisher=publisher,
        title=title,
        excerpt=excerpt,
        published_at=published,
        available_at=max(published, retrieved) if revisable else published,
        observed_at=observed or published,
        retrieved_at=retrieved,
        content_hash=content_hash,
        duplicate_family=url,
        scope="Selected opening passage; not the full report",
        limitations=limitations
        + " Passage may be shortened. No metrics are extracted for the numerical engine.",
        metrics={},
        origin="PUBLIC_RETRIEVAL",
        document_hash=hashlib.sha256(document).hexdigest(),
        parser_version=PARSER_VERSION,
    )


def fed_statement_link(document: bytes, retrieved: datetime) -> tuple[str, datetime]:
    text = document.decode("utf-8-sig", errors="strict")
    if re.search(r"<!\s*(?:DOCTYPE|ENTITY)", text, re.IGNORECASE):
        raise ValueError("Unsafe XML declaration")
    try:
        root = ET.fromstring(text, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except (ET.ParseError, DefusedXmlException) as error:
        raise ValueError("Policy feed is not valid XML") from error
    entries = root.findall("./channel/item")
    if len(entries) > 200:
        raise ValueError("Unexpected feed size")
    statements = []
    for item in entries:
        if (item.findtext("title") or "").strip() != "Federal Reserve issues FOMC statement":
            continue
        url = (item.findtext("link") or "").strip()
        if not allowed_research_url(url) or not url.startswith("https://www.federalreserve.gov/"):
            raise ValueError("Unexpected policy statement link")
        published = parsedate_to_datetime(item.findtext("pubDate") or "")
        if published.tzinfo is None:
            raise ValueError("Policy feed has no timezone")
        if published <= retrieved:
            statements.append((url, published))
    if not statements:
        raise ValueError("No dated FOMC statement in the feed")
    return max(statements, key=lambda item: item[1])


def fed_source(document: bytes, url: str, published: datetime, retrieved: datetime) -> Evidence:
    lines = visible_lines(document)
    start = next(
        (
            i
            for i, line in enumerate(lines)
            if line.startswith(("Recent indicators", "The Federal Open Market Committee approved"))
        ),
        None,
    )
    if start is None:
        raise ValueError("Policy statement body could not be identified")
    end = next(
        (
            i
            for i in range(start, len(lines))
            if lines[i].startswith(("For media inquiries", "Voting for", "Implementation Note"))
        ),
        len(lines),
    )
    excerpt = "\n".join(lines[start:end])
    if len(excerpt) < 200 or "Committee" not in excerpt:
        raise ValueError("Policy statement is incomplete")
    date_label = (
        published.astimezone(ZoneInfo("America/New_York")).strftime("%B %d, %Y").replace(" 0", " ")
    )
    if date_label not in lines:
        raise ValueError("Feed date does not match the policy statement")
    return dated_source(
        kind="MONETARY_POLICY",
        instrument_id=None,
        url=url,
        publisher="Federal Reserve",
        title="FOMC policy statement",
        excerpt=excerpt,
        published=published,
        retrieved=retrieved,
        document=document,
        limitations="Economy-wide policy context; not evidence of company performance.",
    )


def bls_source(document: bytes, release: str, url: str, retrieved: datetime) -> Evidence:
    text = "\n".join(visible_lines(document))
    date = re.search(
        r"(\d{1,2}:\d{2})\s*a\.m\.\s*\(ET\)\s*\w+,?\s*"
        r"([A-Z][a-z]+ \d{1,2}, \d{4})",
        text,
    )
    if not date or "USDL-" not in text:
        raise ValueError("Release publication time could not be verified")
    published = datetime.strptime(f"{date[2]} {date[1]}", "%B %d, %Y %H:%M").replace(
        tzinfo=ZoneInfo("America/New_York")
    )
    heading = "CONSUMER PRICE INDEX" if release == "cpi" else "THE EMPLOYMENT SITUATION"
    match = re.search(rf"{heading}\s*[-–—]\s*([A-Z]+)\s+(\d{{4}})", text)
    if not match:
        raise ValueError("Release period could not be identified")
    period = datetime.strptime(f"{match[1]} {match[2]}", "%B %Y").replace(tzinfo=UTC)
    body = text[match.end() :].strip()
    if len(body) < 200:
        raise ValueError("Release body is incomplete")
    return dated_source(
        kind="ECONOMIC_DATA",
        instrument_id=None,
        url=url,
        publisher="U.S. Bureau of Labor Statistics",
        title=f"{heading.title()} — {match[1].title()} {match[2]}",
        excerpt=body,
        published=published,
        retrieved=retrieved,
        observed=period,
        document=document,
        revisable=True,
        limitations="Economy-wide data; not company performance. Current release pages may be revised; availability starts at retrieval.",
    )


def sec_candidate(
    row: tuple[str, str, str, str, str],
    instrument: Instrument,
    period: datetime | None,
    retrieved: datetime,
) -> SecFiling | None:
    form, filed, report, accession, filename = row
    if form not in {"10-Q", "10-K"}:
        return None
    published = datetime.strptime(filed, "%Y-%m-%d").replace(tzinfo=UTC) + timedelta(days=1)
    observed = datetime.strptime(report, "%Y-%m-%d").replace(tzinfo=UTC)
    if published > retrieved or (period and observed.date() != period.date()):
        return None
    if not re.fullmatch(r"\d{10}-\d{2}-\d{6}", accession):
        raise ValueError("Invalid SEC accession")
    url = f"https://www.sec.gov/Archives/edgar/data/{int(instrument.issuer_cik)}/{accession.replace('-', '')}/{filename}"
    if not allowed_research_url(url):
        raise ValueError("Invalid SEC document name")
    return {"url": url, "published": published, "observed": observed, "form": form}


def sec_filing(
    payload: object, instrument: Instrument, period: datetime | None, retrieved: datetime
) -> SecFiling:
    index = SecIndex.model_validate(payload)
    if str(index.cik).zfill(10) != instrument.issuer_cik:
        raise ValueError("SEC issuer identity did not match")
    approved_names = {
        normalized_name(name)
        for name in (
            instrument.issuer_name,
            *SEC_INDEX_NAME_VARIANTS.get(instrument.issuer_cik, ()),
        )
    }
    if normalized_name(index.name) not in approved_names:
        raise ValueError("SEC company name did not match")
    candidates = []
    for row in index.filings.recent.rows():
        candidate = sec_candidate(row, instrument, period, retrieved)
        if candidate:
            candidates.append(candidate)
    if not candidates:
        raise ValueError("No available SEC annual/quarterly report matches the saved filing period")
    return max(candidates, key=lambda row: row["published"])


def sec_sources(
    document: bytes, filing: SecFiling, instrument: Instrument, retrieved: datetime
) -> list[Evidence]:
    lines = visible_lines(document)
    normalized = re.sub(r"[^a-z0-9]", "", " ".join(lines[:250]).lower())
    if re.sub(r"[^a-z0-9]", "", instrument.issuer_name.lower()) not in normalized:
        raise ValueError("SEC document company identity could not be verified")
    # Require a named section. Annual reports repeat bare "Item 7" page headers;
    # treating those as boundaries truncates the section or creates false duplicates.
    heading = re.compile(r"^item\s+(\d+[a-z]?)(?:\s*[.:-]\s*|\s+)([A-Za-z].{2,})$", re.IGNORECASE)
    targets = {"1a": "risk factors", "2" if filing["form"] == "10-Q" else "7": "management"}
    sources = []
    for item, label in targets.items():
        candidates = []
        for index, line in enumerate(lines):
            match = heading.match(line)
            if not match or match[1].lower() != item:
                continue
            intro = " ".join(lines[index : index + 3]).lower()
            if label not in intro:
                continue
            end = next(
                (j for j in range(index + 1, len(lines)) if heading.match(lines[j])), len(lines)
            )
            excerpt = "\n".join(lines[index:end])
            # Short TOC entries are not report sections. Ambiguous long sections abstain.
            if len(excerpt) >= 300:
                candidates.append(excerpt)
        if len(candidates) != 1:
            continue
        title = "Risk factors" if item == "1a" else "Management discussion"
        sources.append(
            dated_source(
                kind="COMPANY_REPORT",
                instrument_id=instrument.id,
                url=filing["url"],
                publisher=instrument.issuer_name,
                title=f"{instrument.display_name} {filing['form']} — {title}",
                excerpt=candidates[0],
                published=filing["published"],
                observed=filing["observed"],
                retrieved=retrieved,
                document=document,
                limitations="Company-prepared statements, not independent verification. Selected section opening only; absence from this excerpt does not mean absence from the full report.",
            )
        )
    if not sources:
        raise ValueError("Supported report sections could not be identified unambiguously")
    return sources
