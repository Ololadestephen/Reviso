"""Version-bounded research exports assembled only from saved repository state."""

from backend.contracts import utc_now
from backend.instruments import instrument_by_id
from backend.storage import Repository


def research_snapshot(repo: Repository, thesis_id: str, version: int | None = None) -> dict:
    current = repo.get(thesis_id)
    selected_version = version or current["version"]
    record = repo.get_version(thesis_id, selected_version)
    history = repo.history(thesis_id)
    assessments = [
        item for item in history["assessments"] if item["thesis_version"] <= selected_version
    ]
    selected = history["selected_assessment"]
    if not selected or selected["thesis_version"] > selected_version:
        selected = assessments[-1] if assessments else None
    assessment_hash = selected["input_hash"] if selected else None
    answers = [
        item
        for item in repo.research_answers(thesis_id, selected_version)
        if item["thesis_version"] <= selected_version
        and item["assessment_input_hash"] == assessment_hash
    ]
    instrument = instrument_by_id(record["thesis"]["instrument_id"])
    return {
        "schema_version": "reviso-research-export-v1",
        "exported_at": utc_now().isoformat(),
        "instrument": instrument.model_dump(mode="json"),
        "thesis": record,
        "selected_assessment": selected,
        "research_answers": answers,
        "decision_events": [
            item for item in history["events"] if item["version"] <= selected_version
        ],
        "limitations": [
            "Research record only; no trade was placed or recommended.",
            "Tokenized exposure is not direct registered ownership of the underlying share.",
            "Evidence and market observations retain their original dates and limitations.",
        ],
    }


def markdown_snapshot(snapshot: dict) -> str:
    thesis = snapshot["thesis"]
    idea = thesis["thesis"]
    instrument = snapshot["instrument"]
    assessment = snapshot["selected_assessment"]
    lines = [
        f"# Reviso research · {instrument['display_name']}",
        "",
        f"Exported: {snapshot['exported_at']}",
        f"Thesis version: {thesis['version']} ({'confirmed' if thesis['confirmed'] else 'unconfirmed'})",
        f"Instrument: {instrument['id']} · {instrument['base_coin']}/USDT",
        "",
        "## Your idea",
        "",
        idea["rationale"],
        "",
        "## Assumptions",
        "",
    ]
    for item in idea["assumptions"]:
        lines.append(f"- {item['claim']} — {item['invalidation_condition']}")
    lines.extend(
        [
            "",
            "## Position and risk inputs",
            "",
            f"- Proposed amount: {idea['proposed_amount']} USDT",
            f"- Proposed entry: {idea['entry_price']} USDT per token",
            f"- Maximum loss: {idea['max_loss']} USDT",
            f"- Holding period: {idea['holding_days']} days",
            f"- Maximum modeled slippage: {idea['max_slippage_bps']} bps",
            "",
            "## Evidence assessment",
            "",
        ]
    )
    if assessment is None:
        lines.append("No saved assessment for this thesis version.")
    else:
        lines.extend(
            [
                f"State: {assessment['state']}",
                f"Mode: {assessment['mode']}",
                f"Evaluated: {assessment['evaluated_at']}",
                "",
            ]
        )
        for result in assessment["assumptions"]:
            lines.append(
                f"- {result['assumption_id']}: {result['state']} — {result['explanation']}"
            )
        lines.extend(["", "### Sources", ""])
        if not assessment["evidence"]:
            lines.append("No evidence was available for this assessment.")
        for source in assessment["evidence"]:
            lines.extend(
                [
                    f"- [{source['title']}]({source['source_url']}) · {source['publisher']}",
                    f"  - Published: {source['published_at']}",
                    f"  - Excerpt: {source['excerpt']}",
                    f"  - Limitations: {source['limitations']}",
                ]
            )
    lines.extend(["", "## Cited follow-up answers", ""])
    if not snapshot["research_answers"]:
        lines.append("No saved follow-up answers for this assessment.")
    for item in snapshot["research_answers"]:
        lines.extend(
            [
                f"### {item['question']}",
                "",
                item["answer"]["summary"],
                "",
                f"Uncertainty: {item['answer']['uncertainty']}",
                f"Evidence IDs: {', '.join(item['answer']['evidence_ids']) or 'none'}",
                "",
            ]
        )
    lines.extend(["## Decision history", ""])
    if not snapshot["decision_events"]:
        lines.append("No saved decisions through this version.")
    for event in snapshot["decision_events"]:
        lines.append(
            f"- v{event['version']} · {event['action']} · {event['at']} — {event['explanation']}"
        )
    lines.extend(["", "## Limitations", ""])
    lines.extend(f"- {item}" for item in snapshot["limitations"])
    return "\n".join(lines) + "\n"
