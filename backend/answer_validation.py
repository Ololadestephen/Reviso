"""Provider-only claim attribution; saved chat keeps its existing public contract."""

import re
from decimal import Decimal

from pydantic import Field

from backend.contracts import Contract, Evidence, ResearchAnswer, ThesisInput

EXCERPT_CHARS = 720
PERCENTAGE = re.compile(
    r"(?<![\w.,])([+-]?\d[\d,]*(?:\.\d+)?)\s*(?:%|percent\b|per cent\b)",
    re.IGNORECASE,
)


class CitedStatement(Contract):
    text: str = Field(min_length=5, max_length=3000)
    evidence_ids: list[str] = Field(max_length=20)


class CitedAnswer(Contract):
    summary: CitedStatement
    facts: list[CitedStatement] = Field(max_length=3)
    uncertainty: CitedStatement


ANSWER_SCHEMA = CitedAnswer.model_json_schema()


def percentage_value(number: str) -> Decimal:
    groups = number.lstrip("+-").split(".")[0].split(",")
    if len(groups) > 1 and (
        not 1 <= len(groups[0]) <= 3
        or any(len(group) != 3 or not group.isdigit() for group in groups[1:])
    ):
        raise ValueError("A percentage has malformed digit grouping")
    return Decimal(number.replace(",", ""))


def percentages(text: str) -> set[Decimal]:
    return {percentage_value(match.group(1)) for match in PERCENTAGE.finditer(text)}


def validate_percentages(
    statement: CitedStatement, sources: list[Evidence], thesis: ThesisInput
) -> None:
    """Reject uncited percentages, including numbers borrowed from other passages.

    This is a bounded attribution check, not general semantic verification. Confirmed
    floors are user conditions, not source observations, and must be labelled as such.
    Only the excerpt actually sent to the model and reported metrics are eligible.
    """
    sourced = set().union(
        *(
            percentages(source.excerpt[:EXCERPT_CHARS]) | set(source.metrics.values())
            for source in sources
        )
    )
    floors = {item.minimum for item in thesis.assumptions if item.metric != "manual"}
    for match in PERCENTAGE.finditer(statement.text):
        value = percentage_value(match.group(1))
        before = statement.text[: match.start()]
        after = statement.text[match.end() :]
        labelled_floor = re.search(
            r"(?:your|confirmed|constructed)\s+(?:minimum|threshold|floor)(?:\s+is|\s+of|\s*:)?\s*$",
            before,
            re.IGNORECASE,
        ) or re.match(r"\s+(?:minimum|threshold|floor)\b", after, re.IGNORECASE)
        if labelled_floor and value in floors:
            continue
        if value not in sourced:
            raise ValueError("A percentage is absent from this statement's cited sources")


def validated_answer(
    raw: object, evidence: list[Evidence], thesis: ThesisInput, detail: bool
) -> ResearchAnswer:
    candidate = CitedAnswer.model_validate(raw)
    statements = [candidate.summary, *candidate.facts, candidate.uncertainty]
    word_limit = 160 if detail else 70
    if sum(len(item.text.split()) for item in statements) > word_limit:
        raise ValueError(f"The complete answer exceeds {word_limit} words")
    available = {item.id: item for item in evidence}
    for index, statement in enumerate(statements):
        if not set(statement.evidence_ids) <= available.keys():
            raise ValueError("An answer statement cited evidence outside the selected set")
        if index < len(statements) - 1 and evidence and not statement.evidence_ids:
            raise ValueError("The summary and each fact must identify their sources")
        if candidate.facts and not evidence:
            raise ValueError("An answer cannot list reported facts without evidence")
        validate_percentages(
            statement, [available[item] for item in statement.evidence_ids], thesis
        )
    return ResearchAnswer(
        summary=candidate.summary.text,
        facts=[item.text for item in candidate.facts],
        uncertainty=candidate.uncertainty.text,
        evidence_ids=list(
            dict.fromkeys(source_id for item in statements for source_id in item.evidence_ids)
        ),
    )
