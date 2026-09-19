import { useEffect } from "react";
import {
  aiHelpCopy,
  humanGaps,
  isGeneralLimitation,
  llmProviderLabel,
  resultLead,
  resultTally,
} from "./lib/format";
import { markAutoReviewed, wasAutoReviewed } from "./lib/autoReview";
import type {
  Assessment,
  Evidence,
  Instrument,
  LLMStatus,
} from "./api/schemas";

function newestSource(evidence: Evidence[]) {
  return evidence.reduce<Evidence | undefined>((latest, item) => {
    if (!latest || item.published_at > latest.published_at) return item;
    return latest;
  }, undefined);
}

function citedSources(latest: Assessment): Evidence[] {
  const reviewIds = new Set(
    (latest.narrative_review?.items ?? []).flatMap((item) => item.evidence_ids),
  );
  const fromReview = latest.evidence.filter((item) => reviewIds.has(item.id));
  if (fromReview.length) return fromReview;
  const newest = newestSource(latest.evidence);
  return newest ? [newest] : [];
}

export default function ReplayPanel({
  writing,
  pending,
  active,
  replay,
  refresh,
  latest,
  reviewWithAI,
  reviewFailed = false,
  llmStatus,
  instrument,
  priorAssessment = null,
  onOpenSource,
  compact = false,
}: {
  writing: boolean;
  pending: {
    refresh: boolean;
    review: boolean;
    replayStep: number | null;
  };
  active: boolean;
  replay: (step: number) => void;
  refresh: () => void;
  latest: Assessment | null;
  reviewWithAI: () => void;
  reviewFailed?: boolean;
  llmStatus: LLMStatus;
  instrument: Instrument;
  priorAssessment?: Assessment | null;
  onOpenSource?: (evidence: Evidence) => void;
  compact?: boolean;
}) {
  const loadLabel = (step: number) =>
    pending.replayStep === step ? "Loading…" : "Load";
  const retrieval = latest?.disclosure_retrieval;
  const gaps = humanGaps(
    (latest?.missing ?? []).filter(
      (item) => !(retrieval?.warnings ?? []).includes(item),
    ),
  );
  const affecting = gaps.filter((item) => !isGeneralLimitation(item));
  const general = gaps.filter(isGeneralLimitation);
  const headline = latest
    ? resultTally(latest.state, latest.assumptions)
    : `Check the latest ${instrument.display_name} filing`;
  const hasEvidence = Boolean(latest?.evidence.length);
  const review = latest?.narrative_review;
  const source = latest ? newestSource(latest.evidence) : undefined;
  const sources = latest ? citedSources(latest) : [];

  useEffect(() => {
    const key = latest?.input_hash ?? "";
    if (
      !hasEvidence ||
      review ||
      pending.review ||
      pending.refresh ||
      pending.replayStep !== null ||
      !llmStatus.configured ||
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
    llmStatus.configured,
    pending.refresh,
    pending.replayStep,
    pending.review,
    review,
    reviewFailed,
    reviewWithAI,
  ]);

  return (
    <section className="panel evidence-result">
      <span className="eyebrow">RESULT</span>
      <h2>{headline}</h2>
      {source ? (
        <p className="result-source">
          <button type="button" onClick={() => onOpenSource?.(source)}>
            {source.title}
          </button>
          <span>
            {" · "}
            {new Date(source.published_at).toLocaleDateString()}
            {latest?.mode === "HISTORICAL_REPLAY"
              ? " · older example filing"
              : latest?.mode === "LIVE_REFRESH"
                ? " · latest allowlisted filing"
                : ""}
          </span>
        </p>
      ) : latest ? (
        <p className="result-source">
          {latest.mode === "LIVE_REFRESH"
            ? "Checked against the latest official filing we could retrieve."
            : latest.mode === "HISTORICAL_REPLAY"
              ? "This is an older NVIDIA filing used as an example."
              : "This includes a what-if number check, not a new filing."}{" "}
          {new Date(latest.evaluated_at).toLocaleString()}.
        </p>
      ) : null}

      {latest && review && (
        <div className="result-explanation">
          <p>{review.summary}</p>
          {review.next_question ? (
            <p>Still missing: {review.next_question}</p>
          ) : null}
          {sources.length > 0 && (
            <div className="evidence-links">
              {sources.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => onOpenSource?.(item)}
                >
                  {item.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {latest && !review && !hasEvidence && <p>{resultLead(latest)}</p>}
      {hasEvidence && !review && pending.review && (
        <p role="status">Writing a short explanation…</p>
      )}
      {hasEvidence &&
        !review &&
        !pending.review &&
        llmStatus.configured &&
        !reviewFailed && <p role="status">Writing a short explanation…</p>}
      {hasEvidence && !review && !pending.review && reviewFailed && (
        <div>
          <p>Explanation unavailable. The result above still stands.</p>
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
        !llmStatus.configured &&
        !reviewFailed && <p>{aiHelpCopy(false, true)}</p>}

      {affecting.length > 0 && (
        <ul className="result-limits-live">
          {affecting.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
      {general.length > 0 && (
        <details className="result-limits">
          <summary>What this check does not cover</summary>
          <ul>
            {general.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      )}

      {!latest && (
        <div className="result-missing">
          <strong>No filing loaded yet</strong>
          <p>
            Check the latest report first. You can still record a decision that
            says the evidence was missing.
          </p>
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
            Checked {new Date(retrieval.checked_at).toLocaleString()}
            {retrieval.cached ? " · cached result" : ""}
          </p>
          {retrieval.warnings.map((warning) => (
            <p className="caption" key={warning}>
              {warning}
            </p>
          ))}
        </div>
      )}
      {latest &&
        latest.evidence.length === 0 &&
        priorAssessment &&
        priorAssessment.evidence.length > 0 && (
          <div className="prior-evidence">
            <strong>An earlier filing is still saved</strong>
            <p>
              The latest check did not erase the earlier filing from{" "}
              {new Date(priorAssessment.evaluated_at).toLocaleString()}. It is
              not the current result.
            </p>
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

      {latest?.llm_provenance && (
        <details className="technical-details">
          <summary>Technical details</summary>
          <p>
            {llmProviderLabel(latest.llm_provenance.provider)} ·{" "}
            {latest.llm_provenance.model} ·{" "}
            {latest.llm_provenance.prompt_version}
          </p>
        </details>
      )}

      <div className="result-toolbar">
        <button
          className={latest ? "quiet" : "wide primary"}
          disabled={writing || !active}
          onClick={refresh}
        >
          {pending.refresh
            ? "Checking the official filing…"
            : latest
              ? latest.disclosure_retrieval?.availability === "UNAVAILABLE"
                ? "Retry filing"
                : "Refresh filing"
              : `Check latest ${instrument.display_name} filing`}
        </button>
      </div>
      {!compact && instrument.historical_replay_available && (
        <details className="historical-replay">
          <summary>See an older NVIDIA filing example</summary>
          <p>
            Each step only shows documents that were available then. This is not
            a token-price backtest.
          </p>
          <div className="replay-step">
            <span>01</span>
            <div>
              <strong>August 29, 2024</strong>
              <p>Second-quarter filing available</p>
            </div>
            <button disabled={writing || !active} onClick={() => replay(0)}>
              {loadLabel(0)}
            </button>
          </div>
          <div className="replay-step">
            <span>02</span>
            <div>
              <strong>November 21, 2024</strong>
              <p>Third-quarter filing available</p>
            </div>
            <button disabled={writing || !active} onClick={() => replay(1)}>
              {loadLabel(1)}
            </button>
          </div>
        </details>
      )}
    </section>
  );
}
