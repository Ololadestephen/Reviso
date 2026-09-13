import { useState } from "react";
import type {
  InstrumentId,
  Evidence,
  History,
  LLMProvenance,
  LLMStatus,
  ThesisInput,
  ThesisRecord,
} from "./api/schemas";
import {
  emptyThesis,
  fromThesisInput,
  validateThesis,
  type EditableThesis,
} from "./domain/defaults";
import {
  useConfirmThesis,
  useExtractProposal,
  useHistory,
  useInstruments,
  useLlmStatus,
  useRecordDecision,
  useRefreshEvidence,
  useReplayStep,
  useReviewEvidence,
  useReviseThesis,
  useRunStress,
  useSaveDraft,
  useSuggestAssumptions,
  useThesis,
} from "./queries/workspace";

const emptyHistory: History = {
  versions: [],
  assessments: [],
  events: [],
  selected_assessment: null,
};

const unconfiguredLlm: LLMStatus = {
  provider: "bitget-qwen",
  model: "qwen3.8-max",
  configured: false,
  extraction_prompt: "thesis-extraction-v2",
  review_prompt: "evidence-review-v3",
  streaming: "untested",
};

/**
 * Holds the editable draft next to the saved record. The draft resets during
 * render whenever the identity it was derived from changes, so switching or
 * saving a thesis never shows one version's fields against another's state.
 */
function useThesisDraft(
  record: ThesisRecord | null,
  initialDraft: EditableThesis,
) {
  const identity = record
    ? `${record.id}:${record.version}`
    : `new:${initialDraft.instrument_id}:${initialDraft.rationale}`;
  const [form, setForm] = useState<EditableThesis>(() =>
    structuredClone(initialDraft),
  );
  const [editing, setEditing] = useState(false);
  const [syncedTo, setSyncedTo] = useState(identity);

  if (identity !== syncedTo) {
    setSyncedTo(identity);
    setForm(
      record ? fromThesisInput(record.thesis) : structuredClone(initialDraft),
    );
    setEditing(false);
  }

  return { form, setForm, editing, setEditing };
}

/**
 * @param thesisId the thesis in the URL, or null while drafting a new one.
 * @param onCreated called once a draft has an identity worth navigating to.
 */
export function useWorkspace(
  thesisId: string | null,
  onCreated: (record: ThesisRecord) => void,
  initialDraft: EditableThesis = emptyThesis(),
) {
  const [source, setSource] = useState<Evidence | null>(null);
  const [explanation, setExplanation] = useState("");
  const [llmProvenance, setLlmProvenance] = useState<LLMProvenance | null>(
    null,
  );
  const [localError, setLocalError] = useState<Error | null>(null);

  const thesisQuery = useThesis(thesisId);
  const historyQuery = useHistory(thesisId);
  const llmQuery = useLlmStatus();
  const instrumentsQuery = useInstruments();

  const record = thesisQuery.data ?? null;
  const history = historyQuery.data ?? emptyHistory;
  const latest =
    history.selected_assessment ?? history.assessments.at(-1) ?? null;
  const { form, setForm, editing, setEditing } = useThesisDraft(
    record,
    initialDraft,
  );

  const draftMutation = useSaveDraft(onCreated);
  const confirmMutation = useConfirmThesis(record);
  const replayMutation = useReplayStep(record);
  const refreshMutation = useRefreshEvidence(record);
  const reviewMutation = useReviewEvidence(record);
  const decideMutation = useRecordDecision(record);
  const reviseMutation = useReviseThesis(record);
  const stressMutation = useRunStress(thesisId);
  const extractMutation = useExtractProposal();
  const suggestMutation = useSuggestAssumptions();

  const mutations = [
    draftMutation,
    confirmMutation,
    replayMutation,
    refreshMutation,
    reviewMutation,
    decideMutation,
    reviseMutation,
    stressMutation,
    extractMutation,
    suggestMutation,
  ];

  /**
   * One visible error at a time, newest first. Load failures rank behind write
   * failures because a write is the action the user just took.
   */
  const failure =
    localError ??
    mutations.find((mutation) => mutation.error)?.error ??
    thesisQuery.error ??
    historyQuery.error ??
    instrumentsQuery.error ??
    null;

  function clearErrors() {
    setLocalError(null);
    for (const mutation of mutations) if (mutation.error) mutation.reset();
  }

  function withValidThesis(action: (thesis: ThesisInput) => void) {
    clearErrors();
    const parsed = validateThesis(form);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      setLocalError(
        new Error(
          `${first.path.join(".") || "Thesis"}: ${first.message}. Review the highlighted step before continuing.`,
        ),
      );
      return;
    }
    action(parsed.data);
  }

  const pending = {
    draft: draftMutation.isPending,
    confirm: confirmMutation.isPending,
    /** Which replay step is loading, so only that button reports progress. */
    replayStep: replayMutation.isPending
      ? (replayMutation.variables ?? null)
      : null,
    refresh: refreshMutation.isPending,
    review: reviewMutation.isPending,
    decide: decideMutation.isPending,
    revise: reviseMutation.isPending,
    stress: stressMutation.isPending,
    extract: extractMutation.isPending,
    suggest: suggestMutation.isPending,
  };

  /** Any write is in flight; a concurrent write would race the version check. */
  const writing = mutations.some((mutation) => mutation.isPending);

  return {
    thesisId,
    record,
    history,
    latest,
    loading: thesisQuery.isLoading || historyQuery.isLoading,
    error: failure,
    clearErrors,
    pending,
    writing,
    form,
    setForm,
    formValidation: validateThesis(form),
    editing,
    setEditing,
    explanation,
    setExplanation,
    source,
    setSource,
    llmStatus: llmQuery.data ?? unconfiguredLlm,
    llmStatusUnavailable: llmQuery.isError,
    llmProvenance,
    instruments: instrumentsQuery.data ?? [],
    instrumentsLoading: instrumentsQuery.isLoading,
    reviewFailed: reviewMutation.isError,
    active: !!record?.confirmed && !record.retired,

    create: () => withValidThesis((thesis) => draftMutation.mutate(thesis)),
    confirm: (onSuccess?: () => void) =>
      withValidThesis((thesis) =>
        confirmMutation.mutate(thesis, { onSuccess }),
      ),
    replay: (step: number) => {
      clearErrors();
      replayMutation.mutate(step);
    },
    refresh: () => {
      clearErrors();
      refreshMutation.mutate();
    },
    reviewWithAI: () => {
      clearErrors();
      reviewMutation.mutate();
    },
    extractWithAI: () => {
      withValidThesis((thesis) =>
        extractMutation.mutate(thesis, {
          onSuccess: (result) => {
            setForm(fromThesisInput(result.thesis));
            setLlmProvenance(result.provenance);
          },
        }),
      );
    },
    suggestAssumptions: (
      instrumentId: InstrumentId,
      rationale: string,
      onSuccess?: () => void,
    ) => {
      clearErrors();
      if (rationale.trim().length < 10) {
        setLocalError(
          new Error("Describe your idea in at least 10 characters first."),
        );
        return;
      }
      suggestMutation.mutate(
        { instrumentId, rationale },
        {
          onSuccess: (result) => {
            setForm((current) => ({
              ...current,
              rationale: result.rationale,
              assumptions: result.assumptions,
            }));
            onSuccess?.();
          },
        },
      );
    },
    decide: (action: "retain" | "retire") => {
      clearErrors();
      decideMutation.mutate(
        { action, explanation },
        { onSuccess: () => setExplanation("") },
      );
    },
    revise: (onSuccess?: () => void) =>
      withValidThesis((thesis) =>
        reviseMutation.mutate(
          {
            thesis,
            explanation,
            evidenceIds: latest?.evidence.map((item) => item.id) ?? [],
          },
          {
            onSuccess: () => {
              setEditing(false);
              setExplanation("");
              onSuccess?.();
            },
          },
        ),
      ),
    runStress: stressMutation.mutateAsync,
  };
}
