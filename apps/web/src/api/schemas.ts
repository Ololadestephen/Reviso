import { z } from "zod";

/**
 * Mirrors backend/contracts.py and the assembled response bodies in
 * backend/routes.py. Responses are parsed rather than cast, so a backend change
 * surfaces as a precise error at the boundary instead of `undefined` reaching a
 * component. Response envelopes are loose: additive backend fields stay
 * forward compatible, while a required field that disappears or changes type
 * fails loudly.
 */

const numeric = z
  .string()
  .refine((value) => value.trim() !== "" && Number.isFinite(Number(value)), {
    message: "expected a numeric string",
  });

const timestamp = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "expected an ISO timestamp",
  });

export const stateSchema = z.enum([
  "SUPPORTED",
  "CHALLENGED",
  "INVALIDATED",
  "INSUFFICIENT_EVIDENCE",
]);

export const instrumentIdSchema = z.enum([
  "RNVDAUSDT",
  "RAAPLUSDT",
  "RMSFTUSDT",
  "RGOOGLUSDT",
  "RAMZNUSDT",
  "RTSLAUSDT",
]);

export const metricSchema = z.enum([
  "gaap_margin_pct",
  "revenue_growth_yoy_pct",
  "manual",
]);

export const categorySchema = z.enum([
  "fundamental",
  "valuation",
  "instrument",
  "execution",
]);

export const narrativeStanceSchema = z.enum([
  "SUPPORTS",
  "CONTRADICTS",
  "INSUFFICIENT_EVIDENCE",
  "IRRELEVANT",
]);

export const modeSchema = z.enum([
  "CONTROLLED_SCENARIO",
  "HISTORICAL_REPLAY",
  "LIVE_REFRESH",
]);

export const availabilitySchema = z.enum([
  "AVAILABLE",
  "PARTIAL",
  "STALE",
  "UNAVAILABLE",
]);

export const assumptionSchema = z.object({
  id: z.string().min(1).max(80),
  claim: z.string().min(5).max(1000),
  category: categorySchema,
  essential: z.boolean(),
  metric: metricSchema,
  minimum: numeric,
  invalidation_condition: z.string().min(5).max(1000),
});

export const thesisInputSchema = z.object({
  instrument_id: instrumentIdSchema,
  direction: z.literal("long"),
  proposed_amount: numeric,
  entry_price: numeric,
  max_loss: numeric,
  max_slippage_bps: numeric,
  holding_days: z.number().int().min(1).max(3650),
  rationale: z.string().min(10).max(8000),
  assumptions: z.array(assumptionSchema).min(1).max(12),
});

export const thesisRecordSchema = z.looseObject({
  id: z.string(),
  version: z.number().int(),
  confirmed: z.boolean(),
  retired: z.boolean(),
  parent_version: z.number().int().nullable(),
  created_at: timestamp,
  thesis: thesisInputSchema,
});

export const thesisSummarySchema = z.looseObject({
  id: z.string(),
  version: z.number().int(),
  confirmed: z.boolean(),
  retired: z.boolean(),
  created_at: timestamp,
  updated_at: timestamp,
  instrument_id: z.string(),
  rationale: z.string(),
  assumption_count: z.number().int(),
  state: stateSchema.nullable(),
  mode: modeSchema.nullable(),
  assessed_at: timestamp.nullable(),
});

export const evidenceSchema = z.looseObject({
  id: z.string(),
  instrument_id: instrumentIdSchema.nullish(),
  source_url: z.string(),
  publisher: z.string(),
  title: z.string(),
  excerpt: z.string(),
  published_at: timestamp,
  available_at: timestamp,
  observed_at: timestamp,
  retrieved_at: timestamp,
  content_hash: z.string(),
  duplicate_family: z.string(),
  scope: z.string(),
  limitations: z.string(),
  metrics: z.record(z.string(), numeric),
  // Assessments stored before provenance tracking existed carry no origin.
  // The store is append-only, so those records are read as-is and the absence
  // is shown rather than defaulted into a provenance claim they never made.
  origin: z.enum(["CURATED_REPLAY", "PUBLIC_RETRIEVAL"]).optional(),
  document_hash: z.string().nullish(),
  parser_version: z.string().nullish(),
});

/** Shared output of backend/engines.py `walk_bids`. */
const bookWalkSchema = z.looseObject({
  filled_quantity: numeric,
  proceeds: numeric,
  vwap: numeric.nullable(),
  slippage_bps: numeric.nullable(),
  remainder: numeric,
  full_position_evaluable: z.boolean(),
});

/** `walk_bids` plus the fee-adjusted fields that `stress` layers on top. */
export const scenarioExecutionSchema = bookWalkSchema.extend({
  net_proceeds: numeric,
  full_position_pnl: numeric.nullable(),
  slippage_breach: z.boolean().nullable(),
});

/** `walk_bids` against a live book snapshot, from `market_execution`. */
export const marketExecutionSchema = bookWalkSchema.extend({
  mode: z.literal("LIVE_BOOK_SNAPSHOT"),
  instrument_id: z.string(),
  observed_at: timestamp.nullable(),
  reference_midpoint: numeric,
  limitations: z.string(),
});

export const numericalSchema = z.looseObject({
  mode: z.literal("CONTROLLED_SCENARIO"),
  quantity: numeric,
  price_pnl: numeric,
  loss_breach: z.boolean(),
  execution: scenarioExecutionSchema.nullable(),
  premium: numeric.nullable(),
  premium_reason: z.string(),
  breaking_move_pct: numeric.nullable(),
  search: z.string(),
  costs: z.string(),
});

export const bookLevelSchema = z.looseObject({
  price: numeric,
  quantity: numeric,
});

export const scenarioSchema = z.looseObject({
  price_move_pct: numeric,
  spread_bps: numeric,
  depth_multiplier: numeric,
  fee_bps: numeric,
  bids: z.array(bookLevelSchema).nullable(),
});

export const marketSchema = z.looseObject({
  instrument_id: z.string(),
  source: z.string(),
  availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  retrieved_at: timestamp,
  observed_at: timestamp.nullable(),
  book_observed_at: timestamp.nullable(),
  last_price: numeric.nullable(),
  bid: numeric.nullable(),
  ask: numeric.nullable(),
  warnings: z.array(z.string()),
  cached: z.boolean(),
});

export const narrativeReviewSchema = z.looseObject({
  summary: z.string(),
  next_question: z.string(),
  items: z.array(
    z.looseObject({
      assumption_id: z.string(),
      stance: narrativeStanceSchema,
      explanation: z.string(),
      evidence_ids: z.array(z.string()),
    }),
  ),
});

export const llmProvenanceSchema = z.looseObject({
  provider: z.string(),
  model: z.string(),
  prompt_version: z.string(),
  generated_at: timestamp,
  total_ms: z.number().int().nullable().optional(),
  ttft_ms: z.number().int().nullable().optional(),
  repair_attempts: z.number().int().nullable().optional(),
});

export const llmStatusSchema = z.looseObject({
  provider: z.string(),
  model: z.string(),
  configured: z.boolean(),
  extraction_prompt: z.string(),
  review_prompt: z.string(),
  suggestion_prompt: z.string().optional(),
  question_prompt: z.string().optional(),
  streaming: z.string().optional(),
});

export const assessmentSchema = z.looseObject({
  thesis_id: z.string(),
  thesis_version: z.number().int(),
  state: stateSchema,
  mode: modeSchema,
  evidence_cutoff: timestamp,
  evaluated_at: timestamp,
  evidence: z.array(evidenceSchema),
  numerical: numericalSchema,
  scenario: scenarioSchema,
  assumptions: z.array(
    z.looseObject({
      assumption_id: z.string(),
      state: stateSchema,
      explanation: z.string(),
      evidence_ids: z.array(z.string()),
      essential: z.boolean(),
    }),
  ),
  versions: z.looseObject({
    model: z.string(),
    prompt: z.string(),
    engine: z.string(),
    policy: z.string(),
  }),
  missing: z.array(z.string()),
  next_question: z.string(),
  input_hash: z.string(),
  result_hash: z.string(),
  disclosure_retrieval: z
    .looseObject({
      availability: availabilitySchema,
      checked_at: timestamp,
      source: z.string(),
      warnings: z.array(z.string()),
      cached: z.boolean(),
    })
    .optional(),
  market: marketSchema.optional(),
  market_execution: marketExecutionSchema.nullish(),
  narrative_review: narrativeReviewSchema.optional(),
  narrative_context_hash: z.string().optional(),
  narrative_source_input_hash: z.string().optional(),
  llm_provenance: llmProvenanceSchema.optional(),
});

export const decisionEventSchema = z.looseObject({
  action: z.string(),
  explanation: z.string(),
  version: z.number().int(),
  at: timestamp,
  changes: z.array(z.string()).optional(),
  evidence_ids: z.array(z.string()).optional(),
});

export const historySchema = z.looseObject({
  versions: z.array(thesisRecordSchema),
  assessments: z.array(assessmentSchema),
  events: z.array(decisionEventSchema),
  selected_assessment: assessmentSchema.nullable(),
});

export const thesisExtractionSchema = z.looseObject({
  thesis: thesisInputSchema,
  provenance: llmProvenanceSchema,
  warning: z.string(),
});

export const instrumentSchema = z.looseObject({
  id: instrumentIdSchema,
  display_name: z.string(),
  ticker: z.string(),
  base_coin: z.string(),
  provider_symbol: z.string(),
  underlying: z.string(),
  issuer_name: z.string(),
  issuer_cik: z.string(),
  product_type: z.string(),
  quote_currency: z.string(),
  venue: z.string(),
  terms_source: z.string(),
  verified_at: timestamp,
  schedule: z.string(),
  evidence_source: z.string(),
  supported_metrics: z.array(metricSchema),
  historical_replay_available: z.boolean(),
  limitations: z.array(z.string()),
});

export const thesisSuggestionSchema = z.looseObject({
  rationale: z.string(),
  assumptions: z.array(assumptionSchema),
});

export const researchAnswerSchema = z.looseObject({
  summary: z.string(),
  facts: z.array(z.string()),
  uncertainty: z.string(),
  evidence_ids: z.array(z.string()),
});

export const savedResearchAnswerSchema = z.looseObject({
  id: z.string(),
  thesis_id: z.string(),
  thesis_version: z.number().int(),
  assessment_input_hash: z.string(),
  question: z.string(),
  answer: researchAnswerSchema,
  llm_provenance: llmProvenanceSchema,
  input_hash: z.string(),
  created_at: timestamp,
});

export const conversationMessageSchema = z.looseObject({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  kind: z.enum(["explanation", "followup", "detail"]),
  text: z.string(),
  question: z.string().nullable(),
  answer: researchAnswerSchema.nullable(),
  evidence_ids: z.array(z.string()),
  created_at: timestamp,
});

export const conversationThreadSchema = z.looseObject({
  thesis_id: z.string(),
  thesis_version: z.number().int(),
  assessment_input_hash: z.string(),
  context_hash: z.string(),
  messages: z.array(conversationMessageSchema),
});

export type State = z.infer<typeof stateSchema>;
export type InstrumentId = z.infer<typeof instrumentIdSchema>;
export type Metric = z.infer<typeof metricSchema>;
export type Category = z.infer<typeof categorySchema>;
export type NarrativeStance = z.infer<typeof narrativeStanceSchema>;
export type Mode = z.infer<typeof modeSchema>;
export type Assumption = z.infer<typeof assumptionSchema>;
export type ThesisInput = z.infer<typeof thesisInputSchema>;
export type ThesisRecord = z.infer<typeof thesisRecordSchema>;
export type ThesisSummary = z.infer<typeof thesisSummarySchema>;
export type Evidence = z.infer<typeof evidenceSchema>;
export type Numerical = z.infer<typeof numericalSchema>;
export type Scenario = z.infer<typeof scenarioSchema>;
export type MarketObservation = z.infer<typeof marketSchema>;
export type MarketExecution = z.infer<typeof marketExecutionSchema>;
export type NarrativeReview = z.infer<typeof narrativeReviewSchema>;
export type LLMProvenance = z.infer<typeof llmProvenanceSchema>;
export type LLMStatus = z.infer<typeof llmStatusSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type DecisionEvent = z.infer<typeof decisionEventSchema>;
export type History = z.infer<typeof historySchema>;
export type ThesisExtractionResult = z.infer<typeof thesisExtractionSchema>;
export type Instrument = z.infer<typeof instrumentSchema>;
export type ThesisSuggestion = z.infer<typeof thesisSuggestionSchema>;
export type SavedResearchAnswer = z.infer<typeof savedResearchAnswerSchema>;
export type ConversationMessage = z.infer<typeof conversationMessageSchema>;
export type ConversationThread = z.infer<typeof conversationThreadSchema>;
