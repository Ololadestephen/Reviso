import { aiHelpCopy, llmProviderLabel } from "../../lib/format";
import type { Assessment, LLMStatus } from "../../api/schemas";

export default function QwenExplanation({
  latest,
  pendingReview,
  reviewFailed = false,
  llmStatus,
  active,
  writing,
  onRetry,
  embedded = false,
  statusUnavailable = false,
}: {
  latest: Assessment | null;
  pendingReview: boolean;
  reviewFailed?: boolean;
  llmStatus: LLMStatus;
  active: boolean;
  writing: boolean;
  onRetry: () => void;
  embedded?: boolean;
  statusUnavailable?: boolean;
}) {
  const review = latest?.narrative_review;
  const hasEvidence = Boolean(latest?.evidence.length);
  const attention =
    review?.items.filter(
      (item) =>
        item.stance === "CONTRADICTS" ||
        item.stance === "INSUFFICIENT_EVIDENCE",
    ) ?? [];

  if (!hasEvidence) {
    return (
      <section
        className={embedded ? "qwen-explanation" : "panel workspace-aside-card"}
        aria-labelledby="qwen-title"
      >
        <span className="eyebrow">QWEN</span>
        <h2 id="qwen-title">Explanation waits for a filing</h2>
        <p>
          {statusUnavailable
            ? "Could not check whether Qwen is connected. Check a filing first; you can continue without an AI explanation."
            : aiHelpCopy(llmStatus.configured, false)}
        </p>
      </section>
    );
  }

  return (
    <section
      className={embedded ? "qwen-explanation" : "panel workspace-aside-card"}
      aria-labelledby="qwen-title"
    >
      <div className="section-heading">
        <span className="eyebrow">QWEN</span>
        {review && latest?.llm_provenance && (
          <span className="caption">
            {llmProviderLabel(latest.llm_provenance.provider)} ·{" "}
            {latest.llm_provenance.model}
          </span>
        )}
      </div>
      {review && (
        <>
          <h2 id="qwen-title">What this evidence means</h2>
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
            This reading is not part of the result.{" "}
            {latest?.llm_provenance?.prompt_version}. This explanation does not
            change the evidence result.
          </p>
        </>
      )}
      {!review && pendingReview && (
        <div role="status">
          <h2 id="qwen-title">Qwen is writing a short explanation…</h2>
          <p>
            The numbers on the left are already the result. This can take up to
            a minute.
          </p>
        </div>
      )}
      {!review && !pendingReview && statusUnavailable && (
        <>
          <h2 id="qwen-title">Could not check Qwen</h2>
          <p>
            The evidence result is still usable. Try again in a moment, or
            continue without an AI explanation.
          </p>
        </>
      )}
      {!review &&
        !pendingReview &&
        llmStatus.configured &&
        !reviewFailed &&
        !statusUnavailable && (
          <div role="status">
            <h2 id="qwen-title">Qwen is preparing an explanation…</h2>
            <p>
              The filing result stays visible. Qwen will explain this check
              without another click.
            </p>
          </div>
        )}
      {!review && !pendingReview && reviewFailed && (
        <>
          <h2 id="qwen-title">Explanation unavailable</h2>
          <p>
            The evidence result is still usable. You can retry the explanation
            without checking the filing again.
          </p>
          <button
            type="button"
            className="ai-action"
            disabled={writing || !active}
            onClick={onRetry}
          >
            Retry explanation
          </button>
        </>
      )}
      {!review &&
        !pendingReview &&
        !llmStatus.configured &&
        !statusUnavailable && (
          <>
            <h2 id="qwen-title">No AI explanation on this app</h2>
            <p>{aiHelpCopy(false, true)}</p>
          </>
        )}
    </section>
  );
}
