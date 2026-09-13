import {
  assessmentSchema,
  evidenceSchema,
  instrumentSchema,
  llmStatusSchema,
  numericalSchema,
  savedResearchAnswerSchema,
  thesisRecordSchema,
  thesisSummarySchema,
  type Assessment,
  type Evidence,
  type Instrument,
  type LLMStatus,
  type Numerical,
  type SavedResearchAnswer,
  type ThesisRecord,
  type ThesisSummary,
} from "../src/api/schemas";
import { defaultThesis } from "../src/domain/defaults";

/**
 * Fixtures are built through the same schemas the client validates responses
 * with, so a fixture cannot describe a response the real API could not send.
 * A backend contract change breaks these tests instead of passing silently.
 */
type Overrides<T> = Partial<Record<keyof T, unknown>>;

export function makeNumerical(overrides: Overrides<Numerical> = {}): Numerical {
  return numericalSchema.parse({
    mode: "CONTROLLED_SCENARIO",
    quantity: "100",
    price_pnl: "-2000",
    loss_breach: true,
    breaking_move_pct: "-10.1",
    search: "Bounded search",
    costs: "No fees",
    premium: null,
    premium_reason: "No reference",
    execution: null,
    ...overrides,
  });
}

export function makeEvidence(overrides: Overrides<Evidence> = {}): Evidence {
  return evidenceSchema.parse({
    id: "source-1",
    title: "Disclosure",
    publisher: "Publisher",
    source_url: "https://example.com",
    excerpt: "Reported metric.",
    published_at: "2024-08-28T00:00:00Z",
    available_at: "2024-08-29T00:00:00Z",
    observed_at: "2024-08-29T00:00:00Z",
    retrieved_at: "2026-09-10T00:00:00Z",
    scope: "Quarter",
    limitations: "Excerpt",
    content_hash: "hash",
    duplicate_family: "family",
    metrics: { gaap_margin_pct: "74.6" },
    origin: "CURATED_REPLAY",
    ...overrides,
  });
}

export function makeInstrument(
  overrides: Overrides<Instrument> = {},
): Instrument {
  return instrumentSchema.parse({
    id: "RNVDAUSDT",
    display_name: "NVIDIA",
    ticker: "NVDA",
    base_coin: "rNVDA",
    provider_symbol: "RNVDAUSDT",
    underlying: "NVIDIA Corporation / NASDAQ:NVDA",
    issuer_name: "NVIDIA CORPORATION",
    issuer_cik: "0001045810",
    product_type: "Reality tokenized equity exposure",
    quote_currency: "USDT",
    venue: "Bitget spot",
    terms_source: "https://www.bitget.com/example",
    verified_at: "2026-09-10T00:00:00Z",
    schedule: "Availability must be observed",
    evidence_source: "https://nvidianews.nvidia.com/news",
    supported_metrics: ["gaap_margin_pct", "revenue_growth_yoy_pct", "manual"],
    historical_replay_available: true,
    limitations: ["Not direct registered share ownership."],
    ...overrides,
  });
}

export function makeAssessment(
  overrides: Overrides<Assessment> = {},
): Assessment {
  return assessmentSchema.parse({
    thesis_id: "thesis-1",
    thesis_version: 2,
    state: "SUPPORTED",
    mode: "HISTORICAL_REPLAY",
    evidence_cutoff: "2024-08-29T00:00:00Z",
    evaluated_at: "2024-08-29T00:00:00Z",
    evidence: [],
    numerical: makeNumerical(),
    assumptions: [],
    missing: [],
    next_question: "What changed?",
    input_hash: "input-hash",
    result_hash: "result-hash",
    versions: {
      model: "none-manual-confirmation",
      prompt: "none",
      engine: "decimal-v1",
      policy: "confirmed-metric-floor-v1",
    },
    scenario: {
      price_move_pct: "-20",
      spread_bps: "20",
      depth_multiplier: "1",
      fee_bps: "0",
      bids: null,
    },
    ...overrides,
  });
}

export function makeThesisSummary(
  overrides: Overrides<ThesisSummary> = {},
): ThesisSummary {
  return thesisSummarySchema.parse({
    id: "thesis-1",
    version: 2,
    confirmed: true,
    retired: false,
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-11T00:00:00Z",
    instrument_id: "RNVDAUSDT",
    rationale:
      "Data-centre demand can remain strong. Extra context should not appear in the list.",
    assumption_count: 3,
    state: "CHALLENGED",
    mode: "LIVE_REFRESH",
    assessed_at: "2026-09-11T00:00:00Z",
    ...overrides,
  });
}

export function makeRecord(
  overrides: Overrides<ThesisRecord> = {},
): ThesisRecord {
  return thesisRecordSchema.parse({
    id: "thesis-1",
    version: 2,
    confirmed: true,
    retired: false,
    parent_version: 1,
    created_at: "2026-09-10T00:00:00Z",
    thesis: defaultThesis,
    ...overrides,
  });
}

export function makeLlmStatus(overrides: Overrides<LLMStatus> = {}): LLMStatus {
  return llmStatusSchema.parse({
    provider: "groq",
    model: "qwen/qwen3.8-27b",
    configured: false,
    extraction_prompt: "thesis-extraction-v2",
    review_prompt: "evidence-review-v2",
    ...overrides,
  });
}

export function makeResearchAnswer(
  overrides: Overrides<SavedResearchAnswer> = {},
): SavedResearchAnswer {
  return savedResearchAnswerSchema.parse({
    id: "answer-1",
    thesis_id: "thesis-1",
    thesis_version: 2,
    assessment_input_hash: "input-hash",
    question: "Which evidence supports this result?",
    answer: {
      summary: "The saved disclosure reports the selected metric.",
      facts: ["The metric appears in the cited quarterly disclosure."],
      uncertainty: "The next reporting period remains unknown.",
      evidence_ids: ["source-1"],
    },
    llm_provenance: {
      provider: "groq",
      model: "qwen/test",
      prompt_version: "research-question-v1",
      generated_at: "2026-09-10T00:00:00Z",
    },
    input_hash: "question-input-hash",
    created_at: "2026-09-10T00:00:00Z",
    ...overrides,
  });
}

/** No replay, refresh or review in flight. */
export const idlePending = {
  refresh: false,
  review: false,
  replayStep: null,
};

/** A `fetch` stub that answers with one JSON body and status. */
export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
