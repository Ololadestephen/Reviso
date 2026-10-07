import type { Instrument } from "../../api/schemas";
import { reportDate } from "../../lib/resultPresentation";
import {
  researchLinksCheckedOn,
  researchLinksFor,
  xstocksResearchIndex,
} from "./xstocksResearchLinks";

export default function RelatedResearch({
  instrument,
  evidenceCutoff,
}: {
  instrument: Instrument;
  evidenceCutoff: string;
}) {
  const links = researchLinksFor(instrument.id, evidenceCutoff);
  if (links.length === 0) return null;

  function readingList(items: typeof links) {
    return (
      <ul className="related-reading-list">
        {items.map((link) => (
          <li key={link.id}>
            <div>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} (opens in a new tab)`}
              >
                {link.label} <span aria-hidden="true">↗</span>
              </a>
              <small>
                {link.companies.includes(instrument.id)
                  ? `Mentions ${instrument.display_name}`
                  : "Wider market"}
              </small>
            </div>
            <time dateTime={link.publishedOn}>
              {reportDate(`${link.publishedOn}T00:00:00Z`)}
            </time>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="related-research" aria-label="Related research">
      <h2>
        Related research <span>· xStocks</span>
      </h2>
      <p className="caption">
        External reading, not used in this result or chat.
      </p>
      {readingList(links.slice(0, 2))}
      {links.length > 2 && (
        <details>
          <summary>More reading ({links.length - 2})</summary>
          {readingList(links.slice(2))}
        </details>
      )}
      <p className="caption related-reading-footer">
        Links checked {reportDate(`${researchLinksCheckedOn}T00:00:00Z`)}
        {" · "}
        <a
          href={xstocksResearchIndex}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Browse xStocks (opens in a new tab)"
        >
          Browse xStocks <span aria-hidden="true">↗</span>
        </a>
      </p>
    </section>
  );
}
