import { conditionStatusLabel } from "./lib/format";
import type {
  Assessment,
  Evidence,
  History,
  Metric,
  ThesisInput,
} from "./api/schemas";

function metricLabel(metric: Metric) {
  if (metric === "gaap_margin_pct") return "Gross margin";
  if (metric === "revenue_growth_yoy_pct") return "Revenue growth";
  return "Manual condition";
}

function reportedValue(evidence: Evidence[], metric: Metric) {
  return (
    evidence.find((item) => item.metrics[metric] != null)?.metrics[metric] ??
    null
  );
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
  if (!latest?.assumptions.length) return null;
  // The assessed version, not a later edited version, owns these comparisons.
  const assessedThesis =
    history.versions.find(
      (version) => version.version === latest.thesis_version,
    )?.thesis ?? thesis;
  return (
    <section className="findings-panel" aria-labelledby="findings-title">
      <h2 id="findings-title">Your conditions</h2>
      <div className="comparison-labels" aria-hidden="true">
        <span>Condition</span>
        <span>Reported</span>
        <span>Your minimum</span>
        <span>Result</span>
      </div>
      <div className="condition-list">
        {latest.assumptions.map((item) => {
          const assumption = assessedThesis?.assumptions.find(
            (entry) => entry.id === item.assumption_id,
          );
          const claim = assumption?.claim ?? item.assumption_id;
          const cited = item.evidence_ids
            .map((id) => latest.evidence.find((entry) => entry.id === id))
            .filter((entry): entry is Evidence => Boolean(entry));
          const selected = cited.some((entry) => entry.id === selectedId);
          const manual = assumption?.metric === "manual";
          const observed =
            assumption && !manual
              ? reportedValue(cited, assumption.metric)
              : null;
          const uncitedMetric =
            assumption &&
            !manual &&
            reportedValue(latest.evidence, assumption.metric) !== null;
          const reported = manual
            ? "—"
            : observed !== null
              ? `${observed}%`
              : uncitedMetric
                ? "No current number"
                : "Not reported";
          return (
            <article
              key={item.assumption_id}
              className={`comparison-row ${item.state.toLowerCase()}${selected ? " selected" : ""}`}
            >
              <div className="comparison-grid">
                <div className="comparison-condition">
                  <strong>
                    {assumption
                      ? metricLabel(assumption.metric)
                      : item.assumption_id}
                  </strong>
                  {manual && <span className="condition-caption">{claim}</span>}
                  {!item.essential && (
                    <span className="condition-caption">
                      Optional condition
                    </span>
                  )}
                  <div className="condition-sources">
                    {cited.map((source, index) => (
                      <button
                        type="button"
                        className="text-link"
                        key={source.id}
                        aria-label={`View source for ${assumption ? metricLabel(assumption.metric) : item.assumption_id}${cited.length > 1 ? ` (${index + 1})` : ""}`}
                        onClick={() => setSource(source)}
                      >
                        View source ↗
                      </button>
                    ))}
                  </div>
                </div>
                <div className="comparison-value">
                  <span className="mobile-label">Reported</span>
                  <strong>{reported}</strong>
                </div>
                <div className="comparison-value">
                  <span className="mobile-label">Your minimum</span>
                  <strong>
                    {assumption && !manual ? `${assumption.minimum}%` : "—"}
                  </strong>
                </div>
                <span className={`badge ${item.state.toLowerCase()}`}>
                  {manual
                    ? "Needs your review"
                    : conditionStatusLabel(item.state)}
                </span>
              </div>
              <details className="condition-explanation">
                <summary>Condition details</summary>
                <p>{claim}</p>
                <p>{item.explanation}</p>
                {assumption && <p>{assumption.invalidation_condition}</p>}
              </details>
            </article>
          );
        })}
      </div>
    </section>
  );
}
