import { useEffect, useRef } from "react";
import type { Evidence } from "./api/schemas";

/**
 * An assessment saved before provenance tracking records no origin. Saying so
 * is correct; calling it locally curated would assert something never recorded.
 */
function retrievalLabel(origin: Evidence["origin"]) {
  if (origin === "PUBLIC_RETRIEVAL") return "Retrieved from NVIDIA";
  if (origin === "CURATED_REPLAY") return "Locally curated";
  return "Retrieved · origin not recorded";
}

export default function SourceDrawer({
  evidence,
  onClose,
}: {
  evidence: Evidence | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (evidence) dialog.current?.showModal();
    else dialog.current?.close();
  }, [evidence]);
  return (
    <dialog ref={dialog} onCancel={onClose}>
      <div className="drawer-head">
        <span className="eyebrow">SOURCE RECORD</span>
        <button onClick={onClose} aria-label="Close source">
          Close ×
        </button>
      </div>
      {evidence && (
        <>
          <h2>{evidence.title}</h2>
          <p className="muted">{evidence.publisher}</p>
          <blockquote>{evidence.excerpt}</blockquote>
          <a href={evidence.source_url} target="_blank" rel="noreferrer">
            Open primary document ↗
          </a>
          <dl>
            {[
              ["Published · date precision", evidence.published_at],
              ["Evidence available from", evidence.available_at],
              ["Period ended", evidence.observed_at],
              [retrievalLabel(evidence.origin), evidence.retrieved_at],
              ["Scope", evidence.scope],
              ["Limitations", evidence.limitations],
              ["Duplicate family", evidence.duplicate_family],
              ["Excerpt SHA-256", evidence.content_hash],
              ...(evidence.document_hash
                ? [["Document SHA-256", evidence.document_hash]]
                : []),
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </dialog>
  );
}
