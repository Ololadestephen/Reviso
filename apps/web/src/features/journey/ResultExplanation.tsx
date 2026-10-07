import { useId, useState } from "react";
import type { Assessment, Evidence } from "../../api/schemas";
import { researchSources } from "../../lib/researchSources";

function shortReading(text: string) {
  if (text.length <= 240) return text;
  const end = text.lastIndexOf(" ", 240);
  return `${text.slice(0, end > 0 ? end : 240).trimEnd()}…`;
}

export default function ResultExplanation({
  latest,
  primarySourceId,
  onSource,
}: {
  latest: Assessment;
  primarySourceId?: string;
  onSource?: (source: Evidence) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  const review = latest.narrative_review;
  if (!review) return null;
  const citedIds = new Set(review.items.flatMap((item) => item.evidence_ids));
  const additionalSources = researchSources(latest).filter(
    (item) => citedIds.has(item.id) && item.id !== primarySourceId,
  );
  return (
    <div className="result-reading">
      <p className="reading-label">Explanation</p>
      <p id={contentId} className="reading-text">
        {expanded ? review.summary : shortReading(review.summary)}
      </p>
      {expanded && (
        <div className="reading-detail">
          <p>
            <strong>Next question:</strong> {review.next_question}
          </p>
          {additionalSources.map((source) => (
            <button
              key={source.id}
              type="button"
              className="text-link"
              onClick={() => onSource?.(source)}
            >
              {source.title}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="text-link"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((current) => !current)}
      >
        {expanded ? "Read less" : "Read more"}
      </button>
    </div>
  );
}
