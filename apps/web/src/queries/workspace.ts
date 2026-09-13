import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmDraft,
  askResearchQuestion,
  continueConversation,
  extractProposal,
  fetchConversation,
  fetchInstruments,
  fetchResearchAnswers,
  fetchHistory,
  fetchLlmStatus,
  fetchTheses,
  fetchThesis,
  recordDecision,
  refreshEvidence,
  replayEvidence,
  reviewEvidence,
  runStress,
  saveDraft,
  saveRevision,
  suggestAssumptions,
} from "../api/endpoints";
import type {
  Assessment,
  History,
  InstrumentId,
  ThesisInput,
  ThesisRecord,
} from "../api/schemas";
import { queryKeys } from "./client";

export type StressScenario = Parameters<typeof runStress>[1];

export function useTheses() {
  return useQuery({
    queryKey: queryKeys.theses,
    queryFn: ({ signal }) => fetchTheses(signal),
  });
}

export function useThesis(id: string | null) {
  return useQuery({
    queryKey: queryKeys.thesis(id ?? ""),
    queryFn: ({ signal }) => fetchThesis(id as string, signal),
    enabled: id !== null,
  });
}

export function useHistory(id: string | null) {
  return useQuery({
    queryKey: queryKeys.history(id ?? ""),
    queryFn: ({ signal }) => fetchHistory(id as string, signal),
    enabled: id !== null,
  });
}

export function useLlmStatus() {
  return useQuery({
    queryKey: queryKeys.llmStatus,
    queryFn: ({ signal }) => fetchLlmStatus(signal),
    staleTime: 15_000,
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: queryKeys.instruments,
    queryFn: ({ signal }) => fetchInstruments(signal),
    staleTime: 60 * 60_000,
  });
}

export function useResearchAnswers(id: string | null) {
  return useQuery({
    queryKey: queryKeys.questions(id ?? ""),
    queryFn: ({ signal }) => fetchResearchAnswers(id as string, signal),
    enabled: id !== null,
  });
}

export function useConversation(
  id: string | null,
  assessmentInputHash: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.conversation(id ?? "", assessmentInputHash ?? ""),
    queryFn: ({ signal }) =>
      fetchConversation(id as string, assessmentInputHash as string, signal),
    enabled: enabled && id !== null && !!assessmentInputHash,
  });
}

/**
 * Every write invalidates the thesis key, which prefix-matches its history and
 * assessments too, so a single invalidation refreshes the whole workspace.
 */
function useThesisMutation<TArgs, TResult>(
  id: string | null,
  run: (args: TArgs) => Promise<TResult>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      if (id) client.invalidateQueries({ queryKey: queryKeys.thesis(id) });
      client.invalidateQueries({ queryKey: queryKeys.theses, exact: true });
    },
  });
}

function rememberAssessment(assessment: Assessment) {
  return (current: History | undefined) => {
    if (!current) return current;
    const assessments = current.assessments.some(
      (item) => item.input_hash === assessment.input_hash,
    )
      ? current.assessments.map((item) =>
          item.input_hash === assessment.input_hash ? assessment : item,
        )
      : [...current.assessments, assessment];
    return {
      ...current,
      assessments,
      selected_assessment: assessment,
    };
  };
}

function useEvidenceMutation<TArgs>(
  id: string | null,
  run: (args: TArgs) => Promise<Assessment>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (assessment) => {
      if (id) {
        client.setQueryData(
          queryKeys.history(id),
          rememberAssessment(assessment),
        );
        client.invalidateQueries({ queryKey: queryKeys.thesis(id) });
      }
      client.invalidateQueries({ queryKey: queryKeys.theses, exact: true });
    },
  });
}

export function useSaveDraft(onSaved: (record: ThesisRecord) => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (thesis: ThesisInput) => saveDraft(thesis),
    onSuccess: (record) => {
      client.setQueryData(queryKeys.thesis(record.id), record);
      client.invalidateQueries({ queryKey: queryKeys.theses, exact: true });
      onSaved(record);
    },
  });
}

export function useConfirmThesis(record: ThesisRecord | null) {
  return useThesisMutation(record?.id ?? null, (thesis: ThesisInput) =>
    confirmDraft(record as ThesisRecord, thesis),
  );
}

export function useReplayStep(record: ThesisRecord | null) {
  return useEvidenceMutation(record?.id ?? null, (step: number) =>
    replayEvidence(record as ThesisRecord, step),
  );
}

export function useRefreshEvidence(record: ThesisRecord | null) {
  return useEvidenceMutation(record?.id ?? null, () =>
    refreshEvidence(record as ThesisRecord),
  );
}

export function useReviewEvidence(record: ThesisRecord | null) {
  return useEvidenceMutation(record?.id ?? null, () =>
    reviewEvidence(record as ThesisRecord),
  );
}

export function useRecordDecision(record: ThesisRecord | null) {
  return useThesisMutation(
    record?.id ?? null,
    ({
      action,
      explanation,
    }: {
      action: "retain" | "retire";
      explanation: string;
    }) => recordDecision(record as ThesisRecord, action, explanation),
  );
}

export function useReviseThesis(record: ThesisRecord | null) {
  return useThesisMutation(
    record?.id ?? null,
    ({
      thesis,
      explanation,
      evidenceIds,
    }: {
      thesis: ThesisInput;
      explanation: string;
      evidenceIds: string[];
    }) =>
      saveRevision(record as ThesisRecord, thesis, explanation, evidenceIds),
  );
}

export function useRunStress(id: string | null) {
  return useThesisMutation(id, (scenario: StressScenario) =>
    runStress(id as string, scenario),
  );
}

/** An extraction is a proposal only; nothing is persisted, so nothing refetches. */
export function useExtractProposal() {
  return useMutation({
    mutationFn: (current: ThesisInput) => extractProposal(current),
  });
}

export function useSuggestAssumptions() {
  return useMutation({
    mutationFn: ({
      instrumentId,
      rationale,
    }: {
      instrumentId: InstrumentId;
      rationale: string;
    }) => suggestAssumptions(instrumentId, rationale),
  });
}

export function useAskResearchQuestion(record: ThesisRecord | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      question,
      assessmentInputHash,
    }: {
      question: string;
      assessmentInputHash: string;
    }) =>
      askResearchQuestion(
        record as ThesisRecord,
        question,
        assessmentInputHash,
      ),
    onSuccess: () => {
      if (record)
        client.invalidateQueries({ queryKey: queryKeys.questions(record.id) });
    },
  });
}

export function useContinueConversation(record: ThesisRecord | null) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      question,
      assessmentInputHash,
      detail = false,
    }: {
      question: string;
      assessmentInputHash: string;
      detail?: boolean;
    }) =>
      continueConversation(
        record as ThesisRecord,
        question,
        assessmentInputHash,
        detail,
      ),
    onSuccess: (thread) => {
      if (record) {
        client.setQueryData(
          queryKeys.conversation(record.id, thread.assessment_input_hash),
          thread,
        );
      }
    },
  });
}
