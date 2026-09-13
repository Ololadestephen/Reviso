import { z } from "zod";
import { get, post } from "./client";
import {
  assessmentSchema,
  evidenceSchema,
  historySchema,
  instrumentSchema,
  llmStatusSchema,
  marketSchema,
  numericalSchema,
  thesisExtractionSchema,
  thesisSuggestionSchema,
  savedResearchAnswerSchema,
  thesisRecordSchema,
  thesisSummarySchema,
  type Assessment,
  type ThesisInput,
  type InstrumentId,
  type ThesisRecord,
} from "./schemas";

export const fetchLlmStatus = (signal?: AbortSignal) =>
  get("/llm/status", llmStatusSchema, signal);

export const fetchInstrument = (signal?: AbortSignal) =>
  get("/instrument", instrumentSchema, signal);

export const fetchInstruments = (signal?: AbortSignal) =>
  get("/instruments", z.array(instrumentSchema), signal);

export const fetchMarket = (instrumentId: InstrumentId, signal?: AbortSignal) =>
  get(`/market?instrument_id=${instrumentId}`, marketSchema, signal);

export const fetchTheses = (signal?: AbortSignal) =>
  get("/theses", z.array(thesisSummarySchema), signal);

export const fetchThesis = (id: string, signal?: AbortSignal) =>
  get(`/theses/${id}`, thesisRecordSchema, signal);

export const fetchHistory = (id: string, signal?: AbortSignal) =>
  get(`/theses/${id}/assessments`, historySchema, signal);

export const fetchEvidence = (id: string, signal?: AbortSignal) =>
  get(`/evidence/${id}`, evidenceSchema, signal);

export const saveDraft = (thesis: ThesisInput) =>
  post("/theses/draft", thesisRecordSchema, thesis);

export const confirmDraft = (record: ThesisRecord, thesis: ThesisInput) =>
  post(`/theses/${record.id}/confirm`, thesisRecordSchema, {
    ...thesis,
    expected_version: record.version,
  });

export const extractProposal = (current: ThesisInput) =>
  post("/theses/extract", thesisExtractionSchema, { current });

export const suggestAssumptions = (
  instrumentId: InstrumentId,
  rationale: string,
) =>
  post("/theses/suggest", thesisSuggestionSchema, {
    instrument_id: instrumentId,
    rationale,
  });

export const fetchResearchAnswers = (id: string, signal?: AbortSignal) =>
  get(`/theses/${id}/questions`, z.array(savedResearchAnswerSchema), signal);

export const askResearchQuestion = (
  record: ThesisRecord,
  question: string,
  assessmentInputHash: string,
) =>
  post(`/theses/${record.id}/questions`, savedResearchAnswerSchema, {
    question,
    assessment_input_hash: assessmentInputHash,
  });

export const exportThesisUrl = (
  id: string,
  format: "markdown" | "json",
  version?: number,
) =>
  `/api/theses/${id}/export?format=${format}${version ? `&version=${version}` : ""}`;

export const replayEvidence = (record: ThesisRecord, step: number) =>
  post("/replays/nvidia-margin/step", assessmentSchema, {
    thesis_id: record.id,
    expected_version: record.version,
    step,
  });

export const refreshEvidence = (record: ThesisRecord) =>
  post(`/theses/${record.id}/refresh`, assessmentSchema);

export const reviewEvidence = (record: ThesisRecord) =>
  post(`/theses/${record.id}/ai-review`, assessmentSchema);

export const runStress = (
  thesisId: string,
  scenario: Pick<
    Assessment["scenario"],
    "price_move_pct" | "spread_bps" | "depth_multiplier"
  > & { fee_bps?: string; bids?: { price: string; quantity: string }[] },
) => post(`/theses/${thesisId}/stress`, numericalSchema, scenario);

export const recordDecision = (
  record: ThesisRecord,
  action: "retain" | "retire",
  explanation: string,
) =>
  post(`/theses/${record.id}/decisions`, thesisRecordSchema, {
    expected_version: record.version,
    action,
    explanation,
  });

export const saveRevision = (
  record: ThesisRecord,
  thesis: ThesisInput,
  explanation: string,
  evidenceIds: string[],
) =>
  post(`/theses/${record.id}/revisions`, thesisRecordSchema, {
    ...thesis,
    expected_version: record.version,
    explanation,
    evidence_ids: evidenceIds,
  });
