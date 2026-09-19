import { useEffect } from "react";
import {
  aiHelpCopy,
  humanGaps,
  llmProviderLabel,
  resultHeadline,
  resultLead,
  TRUST_LINE,
} from "./lib/format";
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
  replay,
  refresh,
  latest,
  reviewWithAI,
  reviewFailed = false,
  llmStatus,
  instrument,
  priorAssessment = null,
  onOpenSource,
  showExplanation = true,
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
  showExplanation?: boolean;
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
  const headline = latest
    ? resultHeadline(latest.state)
    : `Check the latest ${instrument.display_name} filing`;
  const hasEvidence = Boolean(latest?.evidence.length);
  const review = latest?.narrative_review;
  const attention =
    review?.items.filter(
      (item) =>
        item.stance === "CONTRADICTS" ||
        item.stance === "INSUFFICIENT_EVIDENCE",
    ) ?? [];

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
    <>
      <section className="panel evidence-result">
        <span className="eyebrow">EVIDENCE RESULT</span>
        <h2>{headline}</h2>
        <p>
          {latest
            ? resultLead(latest)
            : `Refresh the official quarterly filing for ${instrument.display_name}. If something is missing, Reviso leaves it missing.`}
        </p>
        {latest && (
          <p className="caption">
            {latest.mode === "HISTORICAL_REPLAY"
              ? "This is an older NVIDIA filing used as an example, not the latest report."
              : latest.mode === "LIVE_REFRESH"
                ? "Checked against the latest official filing we could retrieve."
                : "This includes a what-if number check, not a new filing."}{" "}
            {new Date(latest.evaluated_at).toLocaleString()}.
          </p>
        )}
        <p className="caption">{TRUST_LINE}</p>
        {gaps.length > 0 && (
          <details className="result-limits">
            <summary>
              {gaps.length} {gaps.length === 1 ? "limit" : "limits"} of this
              check
            </summary>
            <ul>
              {gaps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </details>
        )}
        {!latest && (
          <div className="result-missing">
            <strong>No filing loaded yet</strong>
            <p>
              Check the latest report first. You can still record a decision
              that says the evidence was missing.
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
            <p className="recovery-copy">
              You can try again, open the company site, or record a decision
              that says this filing was missing or dated.
            </p>
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
                    ↗ {item.title}
                  </button>
                ))}
              </div>
            </div>
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
          {latest?.evidence.length ? (
            <span className="caption">
              {latest.evidence.length} official source
              {latest.evidence.length === 1 ? "" : "s"} checked
            </span>
          ) : null}
        </div>
        {!compact && instrument.historical_replay_available && (
          <details className="historical-replay">
            <summary>See an older NVIDIA filing example</summary>
            <p>
              Each step only shows documents that were available then. This is
              not a token-price backtest.
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

      {hasEvidence && showExplanation && (
        <section
          className="panel ai-findings"
          aria-labelledby="ai-findings-title"
        >
          <div className="section-heading">
            <span className="eyebrow">QWEN FINDINGS</span>
            {review && latest?.llm_provenance && (
              <span className="caption">
                {llmProviderLabel(latest.llm_provenance.provider)} ·{" "}
                {latest.llm_provenance.model}
              </span>
            )}
          </div>
          {review && (
            <>
              <h2 id="ai-findings-title">What this evidence means</h2>
              <p className="ai-findings-summary">{review.summary}</p>
              {attention.length > 0 && (
                <ul className="ai-findings-points">
                  {attention.map((item) => (
                    <li key={item.assumption_id}>{item.explanation}</li>
                  ))}
                </ul>
              )}
              <p className="ai-findings-next">
                Still unknown: {review.next_question}
              </p>
              <p className="caption">
                {latest?.llm_provenance?.prompt_version}. This explanation does
                not change the evidence result.
              </p>
            </>
          )}
          {!review && pending.review && (
            <div role="status">
              <h2 id="ai-findings-title">
                Qwen is writing a short explanation…
              </h2>
              <p>
                The numbers above are already the result. This can take up to a
                minute.
              </p>
            </div>
          )}
          {!review &&
            !pending.review &&
            llmStatus.configured &&
            !reviewFailed && (
              <div role="status">
                <h2 id="ai-findings-title">
                  Qwen is preparing an explanation…
                </h2>
                <p>
                  The filing result stays visible. Qwen will explain this check
                  without another click.
                </p>
              </div>
            )}
          {!review && !pending.review && reviewFailed && (
            <>
              <h2 id="ai-findings-title">Explanation unavailable</h2>
              <p>
                The evidence result is still usable. You can retry the
                explanation without checking the filing again.
              </p>
              <button
                type="button"
                className="ai-action"
                disabled={writing || !active}
                onClick={reviewWithAI}
              >
                Retry explanation
              </button>
            </>
          )}
          {!review && !pending.review && !llmStatus.configured && (
            <>
              <h2 id="ai-findings-title">No AI explanation on this app</h2>
              <p>{aiHelpCopy(false, true)}</p>
            </>
          )}
        </section>
      )}
    </>
  );
}
