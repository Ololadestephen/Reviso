import { stateLabel } from "./lib/format";
import type { Assessment, Evidence, History } from "./api/schemas";
export default function AssumptionLedger({
  latest,
  history,
  setSource,
}: {
  latest: Assessment | null;
  history: History;
  setSource: (source: Evidence | null) => void;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR CONDITIONS</span>
          <h2>What the evidence shows</h2>
        </div>
      </div>
      {latest ? (
        latest.assumptions.map((item) => (
          <article className="ledger-item" key={item.assumption_id}>
            <div className="ledger-heading">
              <strong>
                {history.versions
                  .find((v) => v.version === latest.thesis_version)
                  ?.thesis.assumptions.find((a) => a.id === item.assumption_id)
                  ?.claim ?? item.assumption_id}
              </strong>
              <span className={`badge ${item.state.toLowerCase()}`}>
                {stateLabel(item.state)}
              </span>
            </div>
            <p>{item.explanation}</p>
            <div className="evidence-links">
              {item.evidence_ids.map((id) => (
                <button
                  key={id}
                  onClick={() =>
                    setSource(latest.evidence.find((e) => e.id === id) ?? null)
                  }
                >
                  ↗ {latest.evidence.find((e) => e.id === id)?.title ?? id} ·
                  primary source
                </button>
              ))}
            </div>
          </article>
        ))
      ) : (
        <div className="empty">
          Confirm your conditions, then load company evidence to see what the
          sources show.
        </div>
      )}
      {latest?.narrative_review && (
        <div className="ai-review">
          <div className="ledger-heading">
            <strong>Qwen’s explanation</strong>
            <span className="badge amber">AI HELP · CHECK IT</span>
          </div>
          <p>{latest.narrative_review.summary}</p>
          {latest.narrative_review.items.map((item) => (
            <article key={item.assumption_id}>
              <strong>
                {item.assumption_id} · {stateLabel(item.stance)}
              </strong>
              <p>{item.explanation}</p>
              <small>Citations: {item.evidence_ids.join(", ") || "none"}</small>
            </article>
          ))}
          <p className="caption">
            {latest.llm_provenance?.model} via {latest.llm_provenance?.provider}{" "}
            · {latest.llm_provenance?.prompt_version}. This explanation does not
            change the evidence result.
          </p>
        </div>
      )}
    </section>
  );
}
