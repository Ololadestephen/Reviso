"""Validated boundaries. Financial quantities are serialized as decimal strings."""

from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

Positive = Annotated[Decimal, Field(gt=0, max_digits=24, decimal_places=10)]
Nonnegative = Annotated[Decimal, Field(ge=0, max_digits=24, decimal_places=10)]
InstrumentId = Literal[
    "RNVDAUSDT",
    "RAAPLUSDT",
    "RMSFTUSDT",
    "RGOOGLUSDT",
    "RAMZNUSDT",
    "RTSLAUSDT",
]
MetricId = Literal["gaap_margin_pct", "revenue_growth_yoy_pct", "manual"]


def canonical_invalidation(metric: MetricId, minimum: Decimal) -> str:
    """Byte-identical to apps/web `conditionText` for the same metric and floor."""
    if metric == "manual":
        return "Requires manual evidence review; no numerical invalidation rule."
    labels = {
        "gaap_margin_pct": "GAAP gross margin",
        "revenue_growth_yoy_pct": "year-over-year revenue growth",
    }
    floor = format(minimum.normalize(), "f")
    return f"Invalidate when reported {labels[metric]} is below {floor}%."


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class State(StrEnum):
    SUPPORTED = "SUPPORTED"
    CHALLENGED = "CHALLENGED"
    INVALIDATED = "INVALIDATED"
    INSUFFICIENT = "INSUFFICIENT_EVIDENCE"


class Assumption(Contract):
    id: str = Field(min_length=1, max_length=80)
    claim: str = Field(min_length=5, max_length=1000)
    category: Literal["fundamental", "valuation", "instrument", "execution"] = "fundamental"
    essential: bool = True
    metric: MetricId
    minimum: Decimal = Field(ge=0, le=1000)
    invalidation_condition: str = Field(min_length=5, max_length=1000)

    @model_validator(mode="after")
    def consistent_condition(self):
        expected = canonical_invalidation(self.metric, self.minimum)
        if self.invalidation_condition != expected:
            if self.metric == "manual":
                raise ValueError("Manual assumptions must use the explicit manual-review condition")
            raise ValueError("The condition text must match the selected metric and floor")
        return self


class ThesisInput(Contract):
    instrument_id: InstrumentId = "RNVDAUSDT"
    direction: Literal["long"] = "long"
    proposed_amount: Positive = Decimal(10000)
    entry_price: Positive = Decimal(100)
    max_loss: Nonnegative = Decimal(1000)
    max_slippage_bps: Nonnegative = Decimal(100)
    holding_days: int = Field(default=90, ge=1, le=3650)
    rationale: str = Field(min_length=10, max_length=8000)
    assumptions: list[Assumption] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def unique_assumptions(self):
        ids = [item.id for item in self.assumptions]
        if len(ids) != len(set(ids)):
            raise ValueError("Assumption IDs must be unique")
        if not any(item.essential for item in self.assumptions):
            raise ValueError("At least one essential assumption is required")
        return self


class Confirmation(ThesisInput):
    expected_version: int = Field(ge=1)


class ThesisExtractionInput(Contract):
    current: ThesisInput


class ThesisIdeaInput(Contract):
    instrument_id: InstrumentId
    rationale: str = Field(min_length=10, max_length=8000)


class ThesisSuggestion(Contract):
    rationale: str = Field(min_length=10, max_length=8000)
    assumptions: list[Assumption] = Field(min_length=1, max_length=6)

    @model_validator(mode="after")
    def unique_assumptions(self):
        ids = [item.id for item in self.assumptions]
        if len(ids) != len(set(ids)):
            raise ValueError("Suggested assumption IDs must be unique")
        return self


class ResearchQuestionInput(Contract):
    question: str = Field(min_length=5, max_length=500)
    assessment_input_hash: str = Field(min_length=64, max_length=64)
    detail: bool = False


class ConversationInput(Contract):
    question: str = Field(min_length=5, max_length=500)
    assessment_input_hash: str = Field(min_length=64, max_length=64)
    detail: bool = False


class ResearchAnswer(Contract):
    summary: str = Field(min_length=5, max_length=3000)
    facts: list[str] = Field(default_factory=list, max_length=12)
    uncertainty: str = Field(min_length=5, max_length=1500)
    evidence_ids: list[str] = Field(max_length=20)


class LLMProvenance(Contract):
    provider: str
    model: str
    prompt_version: str
    generated_at: AwareDatetime
    total_ms: int | None = None
    ttft_ms: int | None = None
    repair_attempts: int | None = None


class ConversationMessage(Contract):
    id: str
    role: Literal["user", "assistant"]
    kind: Literal["explanation", "followup", "detail"] = "followup"
    text: str = Field(min_length=1, max_length=4000)
    question: str | None = None
    answer: ResearchAnswer | None = None
    evidence_ids: list[str] = Field(default_factory=list, max_length=20)
    created_at: AwareDatetime


class ConversationThread(Contract):
    thesis_id: str
    thesis_version: int = Field(ge=1)
    assessment_input_hash: str
    context_hash: str
    messages: list[ConversationMessage] = Field(default_factory=list, max_length=40)


class SavedResearchAnswer(Contract):
    id: str
    thesis_id: str
    thesis_version: int = Field(ge=1)
    assessment_input_hash: str
    question: str
    answer: ResearchAnswer
    llm_provenance: LLMProvenance
    input_hash: str
    created_at: AwareDatetime


class NarrativeStance(StrEnum):
    SUPPORTS = "SUPPORTS"
    CONTRADICTS = "CONTRADICTS"
    INSUFFICIENT = "INSUFFICIENT_EVIDENCE"
    IRRELEVANT = "IRRELEVANT"


class NarrativeReviewItem(Contract):
    assumption_id: str = Field(min_length=1, max_length=80)
    stance: NarrativeStance
    explanation: str = Field(min_length=5, max_length=2000)
    evidence_ids: list[str] = Field(max_length=20)


class NarrativeReview(Contract):
    summary: str = Field(min_length=5, max_length=3000)
    next_question: str = Field(min_length=5, max_length=1000)
    items: list[NarrativeReviewItem] = Field(min_length=1, max_length=12)


class Evidence(Contract):
    id: str
    instrument_id: InstrumentId | None = None
    source_url: str
    publisher: str
    title: str
    excerpt: str
    published_at: AwareDatetime
    available_at: AwareDatetime
    observed_at: AwareDatetime
    retrieved_at: AwareDatetime
    content_hash: str
    duplicate_family: str
    scope: str
    limitations: str
    metrics: dict[str, Decimal]
    origin: Literal["CURATED_REPLAY", "PUBLIC_RETRIEVAL"] = "CURATED_REPLAY"
    document_hash: str | None = None
    parser_version: str | None = None


class XStocksContext(Contract):
    """A separate xStocks product observation; never company filing evidence."""

    instrument_id: InstrumentId
    xstock_symbol: str
    name: str | None = None
    underlying_symbol: str | None = None
    currency: str | None = None
    indicative_price: Positive | None = None
    availability: Literal["AVAILABLE", "PARTIAL", "UNAVAILABLE"]
    retrieved_at: AwareDatetime
    trading_halted: bool | None = None
    market_open: bool | None = None
    trading_period: str | None = None
    networks: list[str] = Field(default_factory=list, max_length=20)
    source_url: str
    research_url: str
    cached: bool = False
    warnings: list[str] = Field(default_factory=list, max_length=10)
    limitations: list[str] = Field(max_length=10)


class BookLevel(Contract):
    price: Positive
    quantity: Nonnegative


class StressInput(Contract):
    price_move_pct: Decimal = Field(default=Decimal(-10), ge=-100, le=100)
    spread_bps: Decimal = Field(default=Decimal(20), ge=0, le=2000)
    depth_multiplier: Decimal = Field(default=Decimal(1), ge=0, le=10)
    fee_bps: Decimal = Field(default=Decimal(0), ge=0, le=1000)
    bids: list[BookLevel] | None = Field(default=None, max_length=100)


class Reference(Contract):
    underlying: str
    currency: str
    token_units_per_share: Positive
    price: Positive
    observed_at: AwareDatetime


class RevisionInput(ThesisInput):
    expected_version: int = Field(ge=1)
    explanation: str = Field(min_length=5, max_length=2000)
    evidence_ids: list[str] = Field(default_factory=list, max_length=20)


class DecisionInput(Contract):
    expected_version: int = Field(ge=1)
    action: Literal["retain", "retire"]
    explanation: str = Field(min_length=5, max_length=2000)


class ReplayInput(Contract):
    thesis_id: str
    expected_version: int = Field(ge=1)
    step: Literal[0, 1]


class ThesisSummary(Contract):
    """Library row: the newest version of a thesis and its selected assessment."""

    id: str
    version: int
    confirmed: bool
    retired: bool
    created_at: AwareDatetime
    updated_at: AwareDatetime
    instrument_id: str
    rationale: str
    assumption_count: int
    state: State | None
    mode: Literal["CONTROLLED_SCENARIO", "HISTORICAL_REPLAY", "LIVE_REFRESH"] | None
    assessed_at: AwareDatetime | None


class AssumptionResult(Contract):
    assumption_id: str
    state: State
    explanation: str
    evidence_ids: list[str]
    essential: bool


def utc_now() -> datetime:
    return datetime.now(UTC)
