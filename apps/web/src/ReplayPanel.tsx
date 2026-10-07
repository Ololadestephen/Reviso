import { useEffect } from "react";
import { humanGaps, isGeneralLimitation, resultLead } from "./lib/format";
import {
  newestSource,
  reportDate,
  resultCounts,
  resultHeading,
  resultMode,
} from "./lib/resultPresentation";
import ResultExplanation from "./features/journey/ResultExplanation";
import { markAutoReviewed, wasAutoReviewed } from "./lib/autoReview";
import type {
  Assessment,
  Evidence,
  Instrument,
  LLMStatus,
} from "./api/schemas";

export default function ReplayPanel({
  writing,
  pending,
  active,
  refresh,
  latest,
  reviewWithAI,
  reviewFailed = false,
  llmStatus,
  instrument,
  priorAssessment = null,
  onOpenSource,
}: {
  writing: boolean;
  pending: {
    refresh: boolean;
    review: boolean;
    replayStep: number | null;
  };
  active: boolean;
  refresh: () => void;
  latest: Assessment | null;
  reviewWithAI: () => void;
  reviewFailed?: boolean;
  llmStatus: LLMStatus;
  instrument: Instrument;
  priorAssessment?: Assessment | null;
  onOpenSource?: (evidence: Evidence) => void;
}) {
  const retrieval = latest?.disclosure_retrieval;
  const gaps = humanGaps(
    (latest?.missing ?? []).filter(
      (item) => !(retrieval?.warnings ?? []).includes(item),
    ),
  );
  const affecting = gaps.filter((item) => !isGeneralLimitation(item));
  const headline = resultHeading(latest);
  const hasEvidence = Boolean(latest?.evidence.length);
  const review = latest?.narrative_review;
  const reviewReady = llmStatus.review_configured ?? llmStatus.configured;
  const source = latest ? newestSource(latest.evidence) : undefined;

  useEffect(() => {
    const key = latest?.input_hash ?? "";
    if (
      !hasEvidence ||
      latest?.research_retrieval !== undefined ||
      review ||
      pending.review ||
      pending.refresh ||
      pending.replayStep !== null ||
      !reviewReady ||
      reviewFailed ||
      !active ||
      !key
    ) {
      return;
    }
    if (wasAutoReviewed(key)) return;
    markAutoReviewed(key);
    reviewWithAI();
  }, [
    active,
    hasEvidence,
    latest?.input_hash,
    latest?.research_retrieval,
    reviewReady,
    pending.refresh,
    pending.replayStep,
    pending.review,
    review,
    reviewFailed,
    reviewWithAI,
  ]);

  return (
    <section className="evidence-result" aria-labelledby="result-title">
      <div className="result-topline">
        <span
          className={`result-mode ${latest?.mode === "HISTORICAL_REPLAY" ? "historical" : ""}`}
        >
          {latest ? resultMode(latest.mode) : "No report loaded"}
        </span>
        <button
          type="button"
          className="primary filing-check"
          aria-busy={pending.refresh}
          disabled={writing || !active}
          onClick={refresh}
        >
          {pending.refresh
            ? "Checking the official filing…"
            : retrieval?.availability === "UNAVAILABLE"
              ? "Retry filing"
              : latest
                ? "Refresh filing"
                : `Check latest ${instrument.display_name} filing`}
        </button>
      </div>
      <h2 id="result-title">{headline}</h2>
      {latest && (
        <p className="result-counts">{resultCounts(latest).join(" · ")}</p>
      )}
      {source ? (
        <div className="result-source-line">
          <span>
            {source.title} · {reportDate(source.published_at)}
          </span>
          <button
            type="button"
            className="text-link"
            onClick={() => onOpenSource?.(source)}
          >
            View report ↗
          </button>
        </div>
      ) : null}
      {latest && review && (
        <ResultExplanation
          key={latest.input_hash}
          latest={latest}
          primarySourceId={source?.id}
          onSource={onOpenSource}
        />
      )}
      {latest && !review && <p className="result-lead">{resultLead(latest)}</p>}
      {hasEvidence && !review && pending.review && (
        <p role="status">Writing a short explanation…</p>
      )}
      {hasEvidence && !review && !pending.review && reviewFailed && (
        <div>
          <p className="caption">
            Explanation unavailable. Your comparisons are still saved.
          </p>
          <button
            type="button"
            className="ai-action"
            disabled={writing || !active}
            onClick={reviewWithAI}
          >
            Retry explanation
          </button>
        </div>
      )}
      {hasEvidence &&
        !review &&
        !pending.review &&
        !reviewReady &&
        !reviewFailed && (
          <p className="caption">
            AI explanation is off. You can still check the numbers.
          </p>
        )}

      {affecting.length > 0 && (
        <ul className="result-limits-live">
          {affecting.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {!latest && (
        <div className="result-missing">
          <p>Load a company report to compare it with your conditions.</p>
        </div>
      )}
      {retrieval && retrieval.availability !== "AVAILABLE" && (
        <div
          className={`retrieval-state ${retrieval.availability.toLowerCase()}`}
          role="status"
        >
          <strong>
            {retrieval.availability === "UNAVAILABLE"
              ? "Latest filing unavailable"
              : `Latest filing ${retrieval.availability.replaceAll("_", " ").toLowerCase()}`}
          </strong>
          <p className="caption">
            {retrieval.availability === "UNAVAILABLE"
              ? "An older report was not used instead. You can retry this check."
              : "This check has incomplete or out-of-date evidence. Read the condition details before deciding."}
          </p>
        </div>
      )}
      {latest &&
        latest.evidence.length === 0 &&
        priorAssessment &&
        priorAssessment.evidence.length > 0 && (
          <div className="prior-evidence">
            <strong>An earlier filing is still saved</strong>
            <p>Previous evidence is saved, but it is not the current result.</p>
            <div className="evidence-links">
              {priorAssessment.evidence.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onOpenSource?.(item)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        )}
    </section>
  );
}
