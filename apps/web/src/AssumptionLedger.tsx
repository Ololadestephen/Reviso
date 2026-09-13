import { findingLabel } from "./lib/format";
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
  return (
    <section className="panel findings-panel" aria-labelledby="findings-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR CONDITIONS</span>
          <h2 id="findings-title">What this filing says</h2>
        </div>
      </div>
      {latest ? (
        latest.assumptions.map((item) => {
          const claim =
            history.versions
              .find((version) => version.version === latest.thesis_version)
              ?.thesis.assumptions.find(
                (assumption) => assumption.id === item.assumption_id,
              )?.claim ?? item.assumption_id;
          const cited = item.evidence_ids
            .map((id) => latest.evidence.find((entry) => entry.id === id))
            .filter((entry): entry is Evidence => Boolean(entry));
          const selected = cited.some((entry) => entry.id === selectedId);
          const heading = (
            <>
              <span
                className={`finding-dot ${
                  item.state === "SUPPORTED"
                    ? "supported"
                    : item.state === "INSUFFICIENT_EVIDENCE"
                      ? "unknown"
                      : "attention"
                }`}
                aria-hidden="true"
              />
              <strong>{claim}</strong>
              <small>{findingLabel(item.state)}</small>
            </>
          );
          return (
            <article
              className={`finding${selected ? " selected" : ""}`}
              key={item.assumption_id}
            >
              {cited[0] ? (
                <button
                  type="button"
                  className="finding-heading"
                  onClick={() => setSource(cited[0])}
                >
                  {heading}
                </button>
              ) : (
                <div className="finding-heading">{heading}</div>
              )}
              <p>{item.explanation}</p>
              {cited.length > 1 && (
                <div className="evidence-links">
                  {cited.map((entry) => (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => setSource(entry)}
                    >
                      ↗ {entry.title} · primary source
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })
      ) : (
        <div className="empty">
          Confirm your conditions, then load company evidence to see what the
          sources show.
        </div>
      )}
    </section>
  );
}
