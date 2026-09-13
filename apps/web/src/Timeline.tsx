import { stateLabel } from "./lib/format";
import type { Assessment, Evidence, History } from "./api/schemas";
export default function Timeline({
  history,
  onSource,
}: {
  history: History;
  onSource: (evidence: Evidence) => void;
}) {
  function change(current: Assessment, index: number) {
    const previous = history.assessments[index - 1];
    if (
      previous &&
      new Date(current.evidence_cutoff) < new Date(previous.evidence_cutoff)
    ) {
      return `Earlier replay cutoff: ${stateLabel(current.state)} (not a recovery)`;
    }
    return previous
      ? `${stateLabel(previous.state)} → ${stateLabel(current.state)}`
      : `First assessment: ${stateLabel(current.state)}`;
  }
  return (
    <section className="panel timeline">
      <span className="eyebrow">SAVED DECISION HISTORY</span>
      <h2>How your idea changed.</h2>
      {!history.versions.length && (
        <p className="muted">Save an idea to begin your history.</p>
      )}
      {history.assessments.map((result, index) => (
        <article key={result.input_hash}>
          <span className="timeline-dot" />
          <div className="ledger-heading">
            <strong>{change(result, index)}</strong>
            <span className="badge">
              v{result.thesis_version} · {result.mode.replaceAll("_", " ")}
            </span>
          </div>
          <p>
            Evidence cutoff: {result.evidence_cutoff} · assessed{" "}
            {new Date(result.evaluated_at).toLocaleString()}
          </p>
          {result.assumptions.map((a) => (
            <p key={a.assumption_id}>
              <strong>{a.assumption_id}:</strong> {a.explanation}
            </p>
          ))}
          <div className="evidence-links">
            {result.evidence.map((e) => (
              <button key={e.id} onClick={() => onSource(e)}>
                ↗ {e.title}
              </button>
            ))}
          </div>
          <details>
            <summary>Technical record</summary>
            <p className="hash">Result SHA-256: {result.result_hash}</p>
          </details>
        </article>
      ))}
      {history.events.map((event, index) => (
        <article key={`event-${index}`}>
          <span className="timeline-dot" />
          <strong>
            v{event.version} · {event.action}
          </strong>
          <p>{event.explanation}</p>
          {event.changes?.map((c) => (
            <p key={c}>{c}</p>
          ))}
        </article>
      ))}
      <details>
        <summary>All saved versions ({history.versions.length})</summary>
        {history.versions.map((v) => (
          <article key={v.version}>
            <strong>Version {v.version}</strong>
            <p>{v.thesis.rationale}</p>
            <p>
              Loss limit {v.thesis.max_loss} USDT · {v.thesis.holding_days} days
            </p>
          </article>
        ))}
      </details>
    </section>
  );
}
