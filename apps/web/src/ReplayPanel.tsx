import {
  aiHelpCopy,
  findingLabel,
  humanGaps,
  resultHeadline,
  resultLead,
} from "./lib/format";
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
  chatOpen = false,
  onOpenChat,
  onOpenSource,
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
  chatOpen?: boolean;
  onOpenChat?: () => void;
  onOpenSource?: (evidence: Evidence) => void;
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
  return (
    <section className="panel evidence-result">
      <div className="section-heading">
        <span className="eyebrow">THE RESULT</span>
        <div className="result-heading-actions">
          {latest && (
            <span className={`badge ${latest.state.toLowerCase()}`}>
              {findingLabel(latest.state)}
            </span>
          )}
          {hasEvidence && (
            <button type="button" className="chat-about" onClick={onOpenChat}>
              Chat about this result
            </button>
          )}
        </div>
      </div>
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
      {review && (
        <div className="ai-explain">
          <h3>What this evidence means</h3>
          <p>{review.summary}</p>
          {attention.length > 0 && (
            <ul>
              {attention.map((item) => (
                <li key={item.assumption_id}>{item.explanation}</li>
              ))}
            </ul>
          )}
          <p className="caption">Still unknown: {review.next_question}</p>
          <p className="caption">
            {latest?.llm_provenance?.model} via{" "}
            {latest?.llm_provenance?.provider} ·{" "}
            {latest?.llm_provenance?.prompt_version}. This explanation does not
            change the evidence result.
          </p>
        </div>
      )}
      {!review && pending.review && (
        <div className="ai-explain" role="status">
          <h3>Qwen is writing a short explanation…</h3>
          <p className="caption">
            The numbers below are already the result. This can take up to a
            minute.
          </p>
        </div>
      )}
      {!review && !pending.review && hasEvidence && llmStatus.configured && (
        <div className="ai-explain">
          <h3>
            {reviewFailed
              ? "Explanation unavailable"
              : "Add a short explanation"}
          </h3>
          <p>
            {reviewFailed
              ? "The evidence result is still usable. You can retry the explanation without checking the filing again."
              : "Qwen can explain what this filing means. It cannot change the numerical result."}
          </p>
          <button
            type="button"
            className="ai-action"
            disabled={writing || !active}
            onClick={reviewWithAI}
          >
            {reviewFailed ? "Retry explanation" : "Explain this result"}
          </button>
        </div>
      )}
      {!review && !pending.review && hasEvidence && !llmStatus.configured && (
        <p className="caption">{aiHelpCopy(false, true)}</p>
      )}
      {gaps.length > 0 && (
        <div className="result-missing">
          <strong>What this check does not cover</strong>
          <ul>
            {gaps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
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
      {retrieval && (
        <div
          className={`retrieval-state ${retrieval.availability.toLowerCase()}`}
          role="status"
        >
          <strong>
            {retrieval.availability === "AVAILABLE"
              ? "Latest filing loaded"
              : retrieval.availability === "UNAVAILABLE"
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
          {retrieval.availability !== "AVAILABLE" && (
            <p className="recovery-copy">
              You can try again, open the company site, or record a decision
              that says this filing was missing or dated.
            </p>
          )}
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
      <button
        className="wide primary"
        disabled={writing || !active}
        onClick={refresh}
      >
        {pending.refresh
          ? "Checking the official filing…"
          : `Check latest ${instrument.display_name} filing`}
      </button>
      {instrument.historical_replay_available && (
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
      {hasEvidence && !chatOpen && (
        <button type="button" className="chat-fab" onClick={onOpenChat}>
          Chat about this result
        </button>
      )}
    </section>
  );
}
