"""Allowlisted, developer-inspected historical excerpts with day-level availability."""

import hashlib
from datetime import datetime
from decimal import Decimal

from backend.contracts import Evidence

SOURCE_BASE = "https://investor.nvidia.com/news/press-release-details/2024/"
RETRIEVED = "2026-09-10T12:00:00+00:00"


def document(
    quarter: str, day: str, available: str, observed: str, margin: str, growth: str, excerpt: str
) -> Evidence:
    return Evidence(
        id=f"nvda-fy25-{quarter}",
        instrument_id="RNVDAUSDT",
        publisher="NVIDIA investor relations",
        source_url=f"{SOURCE_BASE}NVIDIA-Announces-Financial-Results-for-{quarter}-Quarter-Fiscal-2025/default.aspx",
        title=f"NVIDIA FY2025 {quarter} quarter results",
        excerpt=excerpt,
        published_at=day,
        available_at=available,
        observed_at=observed,
        retrieved_at=RETRIEVED,
        content_hash=hashlib.sha256(excerpt.encode()).hexdigest(),
        duplicate_family=f"NVIDIA-FY25-{quarter}",
        scope="NVIDIA company; reported quarter only",
        limitations="Short excerpt, not full document. Day-level publication precision. Token price and liquidity not represented. Retrieval time records local curation date, not original availability.",
        metrics={"gaap_margin_pct": Decimal(margin), "revenue_growth_yoy_pct": Decimal(growth)},
    )


DOCUMENTS = [
    document(
        "Second",
        "2024-08-28T00:00:00Z",
        "2024-08-29T00:00:00Z",
        "2024-07-28T00:00:00Z",
        "75.1",
        "122",
        "Gross margin 75.1%; revenue up 122% from a year ago.",
    ),
    document(
        "Third",
        "2024-11-20T00:00:00Z",
        "2024-11-21T00:00:00Z",
        "2024-10-27T00:00:00Z",
        "74.6",
        "94",
        "Gross margin 74.6%; revenue up 94% from a year ago.",
    ),
]
CUTOFFS = [
    datetime.fromisoformat("2024-08-29T00:00:00+00:00"),
    datetime.fromisoformat("2024-11-21T00:00:00+00:00"),
]
CASES = {"nvidia-margin": "Margin floor breach", "nvidia-growth-control": "Growth negative control"}


def available_evidence(cutoff: datetime) -> list[Evidence]:
    families = {}
    for evidence in DOCUMENTS:
        if evidence.available_at <= cutoff:
            families.setdefault(evidence.duplicate_family, evidence)
    return list(families.values())


def evidence_by_id(evidence_id: str) -> Evidence:
    for evidence in DOCUMENTS:
        if evidence.id == evidence_id:
            return evidence
    raise KeyError(evidence_id)
