import { conditionStatusLabel } from "../../lib/format";
import type { Evidence, History } from "../../api/schemas";

function printSource(evidence: Evidence[]) {
  return evidence.reduce<Evidence | undefined>((latest, item) => {
    if (!latest || item.published_at > latest.published_at) return item;
    return latest;
  }, undefined);
}

export default function PrintHistory({
  history,
  onSource,
}: {
  history: History;
  onSource: (source: Evidence) => void;
}) {
  if (history.assessments.length === 0) return null;
  const selectedHash = history.selected_assessment?.input_hash;
  const decisions = history.events.filter(
    (event) => event.action === "retain" || event.action === "retire",
  );

  return (
    <details className="panel print-history previous-checks">
      <summary className="detail-summary">
        <span>
          <span className="eyebrow">HISTORY</span>
          <strong>Previous checks</strong>
        </span>
        <small>
          {history.assessments.length} saved{" "}
          {history.assessments.length === 1 ? "check" : "checks"}
        </small>
      </summary>
      <div className="detail-body">
        {history.assessments.map((assessment, index) => {
          const source = printSource(assessment.evidence);
          const current = assessment.input_hash === selectedHash;
          const linkedDecisions = decisions.filter(
            (event) => event.assessment_input_hash === assessment.input_hash,
          );
          return (
            <article
              key={assessment.input_hash}
              className={current ? "print-card current" : "print-card"}
            >
              <div className="ledger-heading">
                <strong>
                  Print {index + 1}
                  {source ? ` · ${source.title}` : ""}
                </strong>
                <span className="badge">
                  {current ? "Current check · " : ""}
                  {assessment.mode.replaceAll("_", " ")}
                </span>
              </div>
              <p>
                {source
                  ? `Filing date ${new Date(source.published_at).toLocaleDateString()}`
                  : "No filing available"}{" "}
                · version {assessment.thesis_version} · assessed{" "}
                {new Date(assessment.evaluated_at).toLocaleString()}
              </p>
              {assessment.assumptions.map((item) => (
                <p key={item.assumption_id}>
                  <strong>{item.assumption_id}:</strong>{" "}
                  {conditionStatusLabel(item.state)}
                </p>
              ))}
              {source && (
                <button type="button" onClick={() => onSource(source)}>
                  ↗ {source.title}
                </button>
              )}
              {linkedDecisions.map((event) => (
                <p key={event.version} className="caption">
                  Decision: {event.explanation}
                </p>
              ))}
            </article>
          );
        })}
      </div>
    </details>
  );
}
