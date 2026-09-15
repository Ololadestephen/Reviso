import { conditionStatusLabel } from "./lib/format";
import type { Assessment, Evidence, History } from "./api/schemas";

export default function AssumptionLedger({
  latest,
  history,
  setSource,
  selectedId,
}: {
  latest: Assessment | null;
  history: History;
  setSource: (source: Evidence | null) => void;
  selectedId?: string | null;
}) {
  const presentCount =
    latest?.assumptions.filter((item) => item.evidence_ids.length > 0).length ??
    0;
  const total = latest?.assumptions.length ?? 0;

  return (
    <section className="panel findings-panel" aria-labelledby="findings-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CONFIRMED CONDITIONS</span>
          <h2 id="findings-title">What the filing shows</h2>
        </div>
        {latest && (
          <span className="caption">
            {presentCount} of {total}{" "}
            {total === 1 ? "condition has" : "conditions have"} a cited passage
          </span>
        )}
      </div>
      {latest ? (
        <div className="condition-table-wrap">
          <table className="condition-table">
            <thead>
              <tr>
                <th scope="col">Condition</th>
                <th scope="col">In this filing</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {latest.assumptions.map((item) => {
                const claim =
                  history.versions
                    .find(
                      (version) => version.version === latest.thesis_version,
                    )
                    ?.thesis.assumptions.find(
                      (assumption) => assumption.id === item.assumption_id,
                    )?.claim ?? item.assumption_id;
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
                const source = cited[0] ?? null;
                return (
                  <tr
                    key={item.assumption_id}
                    className={`condition-row-status ${tone}${selected ? " selected" : ""}`}
                  >
                    <th scope="row">
                      <span className="condition-claim">{claim}</span>
                      <details className="condition-explanation">
                        <summary>
                          {source
                            ? "See finding and citation"
                            : "Why evidence is missing"}
                        </summary>
                        <p>{item.explanation}</p>
                        {cited.length > 0 && (
                          <div className="evidence-links">
                            {cited.map((entry) => (
                              <button
                                type="button"
                                key={entry.id}
                                onClick={() => setSource(entry)}
                              >
                                View cited passage
                                {cited.length > 1 ? ` · ${entry.title}` : ""}
                              </button>
                            ))}
                          </div>
                        )}
                      </details>
                    </th>
                    <td>{cited.length > 0 ? "Present" : "Missing"}</td>
                    <td>
                      <span className={`badge ${item.state.toLowerCase()}`}>
                        {conditionStatusLabel(item.state)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
