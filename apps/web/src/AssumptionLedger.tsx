import { conditionStatusLabel } from "./lib/format";
import type {
  Assessment,
  Evidence,
  History,
  Metric,
  ThesisInput,
} from "./api/schemas";

function metricLabel(metric: Metric) {
  if (metric === "gaap_margin_pct") return "GAAP gross margin";
  if (metric === "revenue_growth_yoy_pct")
    return "year-over-year revenue growth";
  return "manual review";
}

function reportedValue(evidence: Evidence[], metric: Metric) {
  for (const item of evidence) {
    const value = item.metrics[metric];
    if (value) return value;
  }
  return null;
}

export default function AssumptionLedger({
  latest,
  history,
  thesis,
  setSource,
  selectedId,
}: {
  latest: Assessment | null;
  history: History;
  thesis?: ThesisInput;
  setSource: (source: Evidence) => void;
  selectedId?: string | null;
}) {
  return (
    <section className="panel findings-panel" aria-labelledby="findings-title">
      <span className="eyebrow">YOUR CONDITIONS</span>
      <h2 id="findings-title">Your conditions</h2>
      {latest ? (
        <div className="condition-list">
          {latest.assumptions.map((item) => {
            const assumption =
              thesis?.assumptions.find(
                (entry) => entry.id === item.assumption_id,
              ) ??
              history.versions
                .find((version) => version.version === latest.thesis_version)
                ?.thesis.assumptions.find(
                  (entry) => entry.id === item.assumption_id,
                );
            const claim = assumption?.claim ?? item.assumption_id;
            const cited = item.evidence_ids
              .map((id) => latest.evidence.find((entry) => entry.id === id))
              .filter((entry): entry is Evidence => Boolean(entry));
            const selected = cited.some((entry) => entry.id === selectedId);
            const tone =
              item.state === "SUPPORTED"
                ? "supported"
                : item.state === "INSUFFICIENT_EVIDENCE"
                  ? "unknown"
                  : item.state === "INVALIDATED"
                    ? "invalidated"
                    : "attention";
            const observed =
              assumption && assumption.metric !== "manual"
                ? reportedValue(cited, assumption.metric)
                : null;
            return (
              <details
                key={item.assumption_id}
                className={`condition-item ${tone}${selected ? " selected" : ""}`}
              >
                <summary>
                  <span className="condition-claim">{claim}</span>
                  <span className={`badge ${item.state.toLowerCase()}`}>
                    {conditionStatusLabel(item.state)}
                  </span>
                </summary>
                <p>{item.explanation}</p>
                {assumption && assumption.metric !== "manual" && (
                  <p>
                    {observed
                      ? `Reported ${metricLabel(assumption.metric)}: ${observed}%. Floor: ${assumption.minimum}%.`
                      : `Floor: ${assumption.minimum}% ${metricLabel(assumption.metric)}. No reported number in the cited passage.`}
                  </p>
                )}
                {cited.length > 0 && (
                  <div className="evidence-links">
                    {cited.map((entry) => (
                      <button
                        type="button"
                        key={entry.id}
                        onClick={() => setSource(entry)}
                      >
                        {entry.title}
                      </button>
                    ))}
                  </div>
                )}
              </details>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          Confirm your conditions, then load company evidence to see what the
          sources show.
        </div>
      )}
    </section>
  );
}
