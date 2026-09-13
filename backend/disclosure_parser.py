"""NVIDIA earnings HTML extraction. Unknown layouts abstain instead of guessing."""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from html.parser import HTMLParser

from backend.contracts import Evidence

PARSER_VERSION = "nvidia-earnings-v1"
MAX_INTRO_CHARACTERS = 1800
TITLE = re.compile(
    r"NVIDIA Announces Financial Results for (First|Second|Third|Fourth) Quarter (?:and )?Fiscal (20\d{2})"
)


@dataclass
class Element:
    tag: str
    attrs: dict[str, str | None] = field(default_factory=dict)
    children: list["Element | str"] = field(default_factory=list)

    def text(self) -> str:
        return " ".join(
            " ".join(c.text() if isinstance(c, Element) else c for c in self.children).split()
        )

    def find(self, tag: str = "", css_class: str = "") -> list["Element"]:
        found = []
        for child in self.children:
            if isinstance(child, Element):
                if (not tag or child.tag == tag) and (
                    not css_class or css_class in (child.attrs.get("class") or "").split()
                ):
                    found.append(child)
                found.extend(child.find(tag, css_class))
        return found


class DisclosureHTML(HTMLParser):
    def __init__(self, html: str):
        super().__init__(convert_charrefs=True)
        self.root = Element("root")
        self.stack: list[Element] = [self.root]
        self.feed(html)
        self.close()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if len(self.stack) > 100:
            raise ValueError("HTML nesting exceeds the supported disclosure layout")
        node = Element(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in {
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
            "param",
            "source",
            "track",
            "wbr",
        }:
            self.stack.append(node)

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                break

    def handle_data(self, data: str) -> None:
        if not any(node.tag in {"script", "style"} for node in self.stack):
            self.stack[-1].children.append(data)


def single(nodes: list[Element]) -> Element:
    if len(nodes) != 1:
        raise ValueError("Expected one unambiguous disclosure section")
    return nodes[0]


def gaap_margin(body: Element, quarter: str, year: str) -> tuple[Decimal | None, str]:
    quarter_number = {"First": 1, "Second": 2, "Third": 3, "Fourth": 4}[quarter]
    expected = f"Q{quarter_number} FY{year[-2:]}"
    candidates = []
    for table in body.find("table"):
        rows = [
            [
                cell.text()
                for cell in row.children
                if isinstance(cell, Element) and cell.tag in {"td", "th"}
            ]
            for row in table.find("tr")
        ]
        if len(rows) < 3 or rows[0] != ["GAAP"] or len(rows[1]) < 2 or rows[1][1] != expected:
            continue
        for row in rows[2:]:
            if len(row) > 1 and row[0].lower() == "gross margin":
                match = re.fullmatch(r"(\d{1,3}(?:\.\d+)?)\s*%", row[1])
                if match and Decimal(match[1]) <= 100:
                    candidates.append(
                        (Decimal(match[1]), f"GAAP table · {expected} · Gross margin: {row[1]}")
                    )
    return candidates[0] if len(candidates) == 1 else (None, "")


def parse_disclosure(html: str, url: str, retrieved_at: datetime) -> Evidence:
    root = DisclosureHTML(html).root
    title = single(root.find(css_class="article-title")).text()
    match = TITLE.fullmatch(title)
    if not match:
        raise ValueError("Not a recognized quarterly earnings release")
    if not url.endswith("/news/" + title.lower().replace(" ", "-")):
        raise ValueError("Disclosure title does not match the discovered source")
    published = datetime.strptime(
        single(root.find(css_class="article-date")).text(), "%B %d, %Y"
    ).replace(tzinfo=UTC)
    body = single(root.find(css_class="article-body"))
    paragraphs = body.find("p")
    if not paragraphs:
        raise ValueError("Missing reported-quarter introduction")
    intro = paragraphs[0].text()
    period = re.search(r"quarter ended ([A-Z][a-z]+ \d{1,2}, 20\d{2}),", intro)
    if (
        not intro.startswith(
            f"NVIDIA (NASDAQ: NVDA) today reported revenue for the {match[1].lower()} quarter ended "
        )
        or not period
    ):
        raise ValueError("Missing unambiguous reported quarter")
    observed = datetime.strptime(period[1], "%B %d, %Y").replace(tzinfo=UTC)
    if not observed <= published <= retrieved_at or len(intro) > MAX_INTRO_CHARACTERS:
        raise ValueError("Invalid disclosure dates or oversized introduction")
    metrics = {}
    growth = re.findall(r"\b(up|down) (\d+(?:\.\d+)?)% from a year ago", intro)
    if len(growth) == 1:
        metrics["revenue_growth_yoy_pct"] = Decimal(growth[0][1]) * (
            1 if growth[0][0] == "up" else -1
        )
    margin, margin_excerpt = gaap_margin(body, match[1], match[2])
    if margin is not None:
        metrics["gaap_margin_pct"] = margin
    excerpt = intro + ("\n\n" + margin_excerpt if margin_excerpt else "")
    content_hash = hashlib.sha256(excerpt.encode()).hexdigest()
    identity = hashlib.sha256(
        f"{url}|{published.isoformat()}|{observed.isoformat()}|{content_hash}".encode()
    ).hexdigest()
    return Evidence(
        id=f"nvda-public-{identity}",
        instrument_id="RNVDAUSDT",
        publisher="NVIDIA Newsroom",
        title=title,
        source_url=url,
        excerpt=excerpt,
        published_at=published,
        available_at=published + timedelta(days=1),
        observed_at=observed,
        retrieved_at=retrieved_at,
        content_hash=content_hash,
        document_hash=hashlib.sha256(html.encode()).hexdigest(),
        origin="PUBLIC_RETRIEVAL",
        parser_version=PARSER_VERSION,
        duplicate_family=f"NVIDIA-FY{match[2]}-{match[1]}",
        scope=f"NVIDIA company; quarter ended {observed.date()} only",
        limitations="Selected introduction and labeled GAAP table row, not the full disclosure. Day-level publication precision. Reported results are not forecasts or token rights. Missing or ambiguous metrics remain unavailable.",
        metrics=metrics,
    )
