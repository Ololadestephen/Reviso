"""Version-bounded research exports assembled only from saved repository state."""

from datetime import UTC, datetime
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import Align, XPos, YPos

from backend.contracts import utc_now
from backend.instruments import instrument_by_id
from backend.storage import Repository

_FONTS = Path(__file__).resolve().parent / "assets" / "fonts"
_MARK = Path(__file__).resolve().parent / "assets" / "reviso-mark.png"

INK = (23, 25, 35)
NAVY = (11, 16, 48)
VIOLET = (91, 92, 246)
MUTED = (96, 101, 113)
RULE = (226, 228, 234)
MINT = (191, 247, 241)
PAPER = (247, 246, 242)
HELD = (31, 122, 77)
BROKE = (180, 35, 24)
WATCH = (181, 71, 8)

_STATE_LABEL = {
    "SUPPORTED": "Supported",
    "CHALLENGED": "Needs attention",
    "INVALIDATED": "Did not hold",
    "INSUFFICIENT_EVIDENCE": "Not enough evidence",
}
_STATE_COLOR = {
    "SUPPORTED": HELD,
    "CHALLENGED": WATCH,
    "INVALIDATED": BROKE,
    "INSUFFICIENT_EVIDENCE": MUTED,
}
_ACTION_LABEL = {
    "retain": "Keep",
    "retire": "Set aside",
    "revise": "Change",
    "confirm": "Confirm",
}
_MODE_LABEL = {
    "HISTORICAL_REPLAY": "Older example filing",
    "LIVE_REFRESH": "Latest allowlisted filing",
    "CONTROLLED_SCENARIO": "What-if check",
}


def _latest_source(evidence: list[dict]) -> dict | None:
    if not evidence:
        return None
    return max(evidence, key=lambda item: item["published_at"])


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
        "assessments": assessments,
        "research_answers": answers,
        "decision_events": [
            item for item in history["events"] if item["version"] <= selected_version
        ],
        "limitations": [
            "Research record only; no trade was placed or recommended.",
            "Tokenized exposure is not direct registered ownership of the underlying share.",
            "Evidence and market observations retain their original dates and limitations.",
            "Qwen did not compute these comparisons. Market price is not used in the finding.",
            "Reviso does not invent a metric, treat an older report as a successful current check, or let an explanation overwrite the comparison.",
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
            "## Saved prints",
            "",
        ]
    )
    prints = snapshot.get("assessments") or ([assessment] if assessment is not None else [])
    if not prints:
        lines.append("No saved assessment for this thesis version.")
    for index, item in enumerate(prints, start=1):
        source = _latest_source(item["evidence"])
        lines.extend(
            [
                f"### Print {index} · {item['state']} · {item['mode']}",
                "",
                f"Filing date: {source['published_at']}" if source else "No filing available.",
                f"Evaluated: {item['evaluated_at']}",
                "",
            ]
        )
        for result in item["assumptions"]:
            lines.append(
                f"- {result['assumption_id']}: {result['state']} — {result['explanation']}"
            )
        lines.extend(["", "Sources", ""])
        if not item["evidence"]:
            lines.append("No evidence was available for this assessment.")
        for source in item["evidence"]:
            lines.extend(
                [
                    f"- [{source['title']}]({source['source_url']}) · {source['publisher']}",
                    f"  - Published: {source['published_at']}",
                    f"  - Excerpt: {source['excerpt']}",
                    f"  - Limitations: {source['limitations']}",
                ]
            )
        lines.append("")
        for source in item.get("research_sources", []):
            lines.extend(
                [
                    f"- Additional research ({source['kind']}): [{source['title']}]({source['source_url']})",
                    f"  - Publisher: {source['publisher']} · Published: {source['published_at']}",
                    f"  - Available: {source['available_at']} · Retrieved: {source['retrieved_at']}",
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
        self.set_margins(20, 36, 20)
        self.alias_nb_pages()
        self.add_font("DejaVu", "", _FONTS / "DejaVuSans.ttf")
        self.add_font("DejaVu", "B", _FONTS / "DejaVuSans-Bold.ttf")

    def header(self):
        self.set_fill_color(*PAPER)
        self.rect(0, 0, 210, 297, "F")
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 26, "F")
        self.set_fill_color(*VIOLET)
        self.rect(0, 26, 210, 1.6, "F")
        self.image(str(_MARK), 14, 7, 12, 12)
        self.set_xy(29, 7.2)
        self.set_text_color(255, 255, 255)
        self.set_font("DejaVu", "B", 14)
        self.cell(70, 7, "Reviso")
        self.set_xy(29, 14)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*MINT)
        self.cell(70, 6, "Research memorandum")
        self.set_xy(108, 8)
        self.set_text_color(183, 188, 218)
        self.set_font("DejaVu", "", 8)
        self.multi_cell(82, 4.6, self.running_title, align=Align.R)
        self.set_y(self.t_margin)
        self.set_text_color(*INK)

    def footer(self):
        self.set_fill_color(*NAVY)
        self.rect(0, 281, 210, 16, "F")
        self.set_xy(20, 285)
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*MINT)
        self.cell(55, 6, "revisoagent.xyz")
        self.set_text_color(183, 188, 218)
        self.cell(60, 6, f"Page {self.page_no()} of {{nb}}", align=Align.C)
        self.set_text_color(255, 255, 255)
        self.cell(55, 6, "No trade was placed.", align=Align.R)


def _break_long(text: str, limit: int = 70) -> str:
    pieces: list[str] = []
    for token in text.split(" "):
        if len(token) <= limit:
            pieces.append(token)
            continue
        rest = token
        chunks: list[str] = []
        while len(rest) > limit:
            cut = rest[: limit + 1].rfind("/")
            if cut < limit // 3:
                cut = limit
            else:
                cut += 1
            chunks.append(rest[:cut])
            rest = rest[cut:]
        chunks.append(rest)
        pieces.append(" ".join(chunks))
    return " ".join(pieces)


def _when(value: str | None) -> str:
    if not value:
        return "—"
    raw = value[:-1] + "+00:00" if value.endswith("Z") else value
    stamp = datetime.fromisoformat(raw)
    if not isinstance(stamp, datetime):
        return f"{stamp.day} {stamp.strftime('%B %Y')}"
    if stamp.tzinfo is not None:
        stamp = stamp.astimezone(UTC).replace(tzinfo=None)
    if stamp.hour or stamp.minute or stamp.second:
        return f"{stamp.day} {stamp.strftime('%B %Y, %H:%M UTC')}"
    return f"{stamp.day} {stamp.strftime('%B %Y')}"


def _write(
    pdf: ResearchPdf,
    text: str,
    size: int,
    *,
    bold: bool = False,
    indent: float = 0,
    color: tuple[int, int, int] = INK,
) -> None:
    pdf.set_font("DejaVu", "B" if bold else "", size)
    pdf.set_text_color(*color)
    pdf.set_x(pdf.l_margin + indent)
    pdf.multi_cell(pdf.epw - indent, size * 0.48 + 1.6, _break_long(text), align=Align.L)


def _rule(pdf: ResearchPdf, *, accent: bool = False) -> None:
    pdf.set_draw_color(*(VIOLET if accent else RULE))
    pdf.set_line_width(0.55 if accent else 0.25)
    y = pdf.get_y()
    pdf.line(pdf.l_margin, y, pdf.l_margin + (28 if accent else pdf.epw), y)
    pdf.ln(3)


def _section(pdf: ResearchPdf, title: str) -> None:
    if pdf.get_y() > 248:
        pdf.add_page()
    else:
        pdf.ln(5)
    pdf.set_font("DejaVu", "B", 8)
    pdf.set_text_color(*VIOLET)
    pdf.cell(0, 5, title.upper(), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    _rule(pdf, accent=True)
    pdf.set_text_color(*INK)


def _meta(pdf: ResearchPdf, rows: list[tuple[str, str]]) -> None:
    for label, value in rows:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("DejaVu", "B", 8)
        pdf.set_text_color(*MUTED)
        pdf.cell(42, 5.4, label)
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(*INK)
        pdf.multi_cell(pdf.epw - 42, 5.4, _break_long(value), align=Align.L)


def _finding(pdf: ResearchPdf, assumption_id: str, state: str, explanation: str) -> None:
    label = _STATE_LABEL.get(state, state)
    _write(
        pdf,
        f"{assumption_id}: {label}",
        10,
        bold=True,
        color=_STATE_COLOR.get(state, INK),
    )
    _write(pdf, explanation, 10)


def pdf_snapshot(snapshot: dict) -> bytes:
    """Readable PDF of the same saved snapshot as the Markdown export."""
    thesis = snapshot["thesis"]
    idea = thesis["thesis"]
    instrument = snapshot["instrument"]
    title = f"Reviso research · {instrument['display_name']}"
    status = "confirmed" if thesis["confirmed"] else "unconfirmed"
    pdf = ResearchPdf(f"{instrument['display_name']}  ·  v{thesis['version']}")
    pdf.add_page()
    pdf.set_title(title)
    pdf.set_author("Reviso")
    pdf.set_creator("Reviso research export")

    _write(pdf, title, 20, bold=True, color=NAVY)
    pdf.ln(0.6)
    _write(pdf, "Private research memorandum · not an order or recommendation", 9, color=VIOLET)
    _write(
        pdf,
        f"{instrument['base_coin']} / USDT  ·  {instrument['id']}  ·  Version {thesis['version']} ({status})",
        10,
        color=MUTED,
    )
    _write(pdf, f"Exported {_when(snapshot['exported_at'])}", 9, color=MUTED)
    pdf.ln(2.5)
    y = pdf.get_y()
    pdf.set_draw_color(*VIOLET)
    pdf.set_line_width(0.85)
    pdf.line(pdf.l_margin, y, pdf.l_margin + 28, y)
    pdf.set_draw_color(*RULE)
    pdf.set_line_width(0.25)
    pdf.line(pdf.l_margin + 30, y, pdf.l_margin + pdf.epw, y)
    pdf.ln(4)

    _section(pdf, "Your idea")
    _write(pdf, idea["rationale"], 11)

    _section(pdf, "Assumptions")
    for item in idea["assumptions"]:
        _write(pdf, item["claim"], 10, bold=True)
        _write(pdf, item["invalidation_condition"], 9, color=MUTED)
        pdf.ln(1.5)

    _section(pdf, "Position and risk inputs")
    _meta(
        pdf,
        [
            ("Proposed amount", f"{idea['proposed_amount']} USDT"),
            ("Proposed entry", f"{idea['entry_price']} USDT per token"),
            ("Maximum loss", f"{idea['max_loss']} USDT"),
            ("Holding period", f"{idea['holding_days']} days"),
            ("Max. slippage", f"{idea['max_slippage_bps']} bps"),
        ],
    )

    _section(pdf, "Saved prints")
    prints = snapshot.get("assessments") or (
        [snapshot["selected_assessment"]] if snapshot["selected_assessment"] is not None else []
    )
    if not prints:
        _write(pdf, "No saved assessment for this thesis version.", 10)
    for index, item in enumerate(prints, start=1):
        source = _latest_source(item["evidence"])
        state = _STATE_LABEL.get(item["state"], item["state"])
        mode = _MODE_LABEL.get(item["mode"], item["mode"].replace("_", " ").title())
        _write(
            pdf,
            f"Print {index}  ·  {state}  ·  {mode}",
            11,
            bold=True,
            color=_STATE_COLOR.get(item["state"], NAVY),
        )
        if source:
            _write(pdf, f"Filing date: {_when(source['published_at'])}", 9, color=MUTED)
        else:
            _write(pdf, "No filing available.", 9, color=MUTED)
        _write(pdf, f"Evaluated: {_when(item['evaluated_at'])}", 9, color=MUTED)
        pdf.ln(1)
        for result in item["assumptions"]:
            _finding(pdf, result["assumption_id"], result["state"], result["explanation"])
        pdf.ln(1)
        _write(pdf, "Sources", 9, bold=True)
        if not item["evidence"]:
            _write(pdf, "No evidence was available for this assessment.", 10)
        for entry in item["evidence"]:
            _write(pdf, f"• {entry['title']} · {entry['publisher']}", 10)
            _write(pdf, entry["source_url"], 8, indent=5, color=MUTED)
            _write(pdf, f"Published: {_when(entry['published_at'])}", 9, indent=5, color=MUTED)
            _write(pdf, f"Excerpt: {entry['excerpt']}", 9, indent=5)
            _write(pdf, f"Limitations: {entry['limitations']}", 9, indent=5, color=MUTED)
        for entry in item.get("research_sources", []):
            _write(pdf, f"Additional research ({entry['kind']}): {entry['title']}", 10, bold=True)
            _write(pdf, f"{entry['publisher']} · {entry['source_url']}", 8, color=MUTED)
            _write(
                pdf,
                f"Published: {_when(entry['published_at'])} · Retrieved: {_when(entry['retrieved_at'])}",
                9,
                color=MUTED,
            )
            _write(pdf, entry["excerpt"], 9)
            _write(pdf, entry["limitations"], 9, color=MUTED)
        pdf.ln(2)

    _section(pdf, "Cited follow-up answers")
    if not snapshot["research_answers"]:
        _write(pdf, "No saved follow-up answers for this assessment.", 10)
    for item in snapshot["research_answers"]:
        _write(pdf, item["question"], 11, bold=True)
        _write(pdf, item["answer"]["summary"], 10)
        _write(pdf, f"Uncertainty: {item['answer']['uncertainty']}", 9, color=MUTED)
        ids = ", ".join(item["answer"]["evidence_ids"]) or "none"
        _write(pdf, f"Evidence IDs: {ids}", 9, color=MUTED)
        pdf.ln(1.5)

    _section(pdf, "Decision history")
    if not snapshot["decision_events"]:
        _write(pdf, "No saved decisions through this version.", 10)
    for event in snapshot["decision_events"]:
        action = _ACTION_LABEL.get(event["action"], event["action"])
        _write(
            pdf,
            f"• v{event['version']}  ·  {action}  ·  {_when(event['at'])} — {event['explanation']}",
            10,
        )

    _section(pdf, "Limitations")
    for item in snapshot["limitations"]:
        _write(pdf, f"• {item}", 9)
    return bytes(pdf.output())
