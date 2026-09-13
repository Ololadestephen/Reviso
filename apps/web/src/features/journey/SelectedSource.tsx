import type { Evidence } from "../../api/schemas";

export default function SelectedSource({
  evidence,
  current,
  onOpenDetails,
}: {
  evidence: Evidence | null;
  current: boolean;
  onOpenDetails: (evidence: Evidence) => void;
}) {
  return (
    <section className="panel selected-source" aria-labelledby="source-title">
      <span className="eyebrow">THE FILING</span>
      <h2 id="source-title">The report we checked</h2>
      {evidence ? (
        <>
          {!current && (
            <p className="source-stale" role="status">
              This source belongs to an earlier check. It is not the current
              result.
            </p>
          )}
          <div className="source-card">
            <span aria-hidden="true">↗</span>
            <div>
              <strong>{evidence.title}</strong>
              <small>
                {evidence.publisher} · published{" "}
                {new Date(evidence.published_at).toLocaleDateString()}
              </small>
            </div>
          </div>
          <p className="caption">
            Period ended {new Date(evidence.observed_at).toLocaleDateString()}
          </p>
          <blockquote>{evidence.excerpt}</blockquote>
          <div className="source-actions">
            <a href={evidence.source_url} target="_blank" rel="noreferrer">
              View filing
            </a>
            <button type="button" onClick={() => onOpenDetails(evidence)}>
              Source details
            </button>
          </div>
        </>
      ) : (
        <div className="empty">
          Load a company filing to see a short excerpt here. If nothing was
          found, that stays empty.
        </div>
      )}
    </section>
  );
}
