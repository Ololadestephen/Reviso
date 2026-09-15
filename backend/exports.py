"""Version-bounded research exports assembled only from saved repository state."""

import re
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align, XPos, YPos

from backend.contracts import utc_now
from backend.instruments import instrument_by_id
from backend.storage import Repository

_FONTS = Path(__file__).resolve().parent / "assets" / "fonts"
_LINK = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")


def research_snapshot(
    repo: Repository, owner_id: str, thesis_id: str, version: int | None = None
) -> dict:
    current = repo.get(owner_id, thesis_id)
    selected_version = version or current["version"]
    record = repo.get_version(owner_id, thesis_id, selected_version)
    history = repo.history(owner_id, thesis_id)
    assessments = [
        item for item in history["assessments"] if item["thesis_version"] <= selected_version
    ]
    selected = history["selected_assessment"]
    if not selected or selected["thesis_version"] > selected_version:
        selected = assessments[-1] if assessments else None
    assessment_hash = selected["input_hash"] if selected else None
    answers = [
        item
        for item in repo.research_answers(owner_id, thesis_id, selected_version)
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


class ResearchPdf(FPDF):
    def __init__(self, running_title: str):
        super().__init__(format="A4")
        self.running_title = running_title
        self.set_auto_page_break(auto=True, margin=22)
        self.set_margins(18, 16, 18)
        self.add_font("DejaVu", "", _FONTS / "DejaVuSans.ttf")
        self.add_font("DejaVu", "B", _FONTS / "DejaVuSans-Bold.ttf")

    def header(self):
        if self.page_no() == 1:
            return
        self.set_font("DejaVu", size=9)
        self.set_text_color(100, 110, 125)
        self.cell(0, 8, self.running_title, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(220, 224, 230)
        self.line(18, self.get_y(), 192, self.get_y())
        self.ln(4)
        self.set_text_color(20, 24, 32)

    def footer(self):
        self.set_y(-16)
        self.set_font("DejaVu", size=8)
        self.set_text_color(110, 118, 130)
        self.cell(
            0,
            8,
            f"Page {self.page_no()}  ·  Research record only; no trade was placed.",
            align=Align.C,
        )


def _break_long(text: str, limit: int = 80) -> str:
    pieces: list[str] = []
    for token in text.split(" "):
        if len(token) <= limit:
            pieces.append(token)
            continue
        pieces.append(
            " ".join(token[index : index + limit] for index in range(0, len(token), limit))
        )
    return " ".join(pieces)


def _write(
    pdf: ResearchPdf, text: str, size: int, *, bold: bool = False, indent: float = 0
) -> None:
    pdf.set_font("DejaVu", "B" if bold else "", size)
    pdf.set_text_color(20, 24, 32)
    pdf.set_x(pdf.l_margin + indent)
    pdf.multi_cell(pdf.epw - indent, size * 0.5 + 1.5, _break_long(text))


def pdf_snapshot(snapshot: dict) -> bytes:
    """Readable PDF of the same saved snapshot as the Markdown export."""
    title = f"Reviso research · {snapshot['instrument']['display_name']}"
    pdf = ResearchPdf(title)
    pdf.add_page()
    for raw in markdown_snapshot(snapshot).splitlines():
        line = _LINK.sub(r"\1 (\2)", raw)
        if line == "":
            pdf.ln(3)
        elif line.startswith("# "):
            _write(pdf, line[2:], 20, bold=True)
            pdf.ln(1)
        elif line.startswith("## "):
            pdf.ln(2)
            _write(pdf, line[3:], 13, bold=True)
            pdf.ln(1)
        elif line.startswith("### "):
            pdf.ln(1)
            _write(pdf, line[4:], 11, bold=True)
        elif line.startswith("- "):
            _write(pdf, f"• {line[2:]}", 10)
        elif line.startswith("  - "):
            _write(pdf, f"– {line[4:]}", 10, indent=6)
        else:
            _write(pdf, line, 10)
    return bytes(pdf.output())
