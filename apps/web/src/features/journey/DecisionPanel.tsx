import { exportThesisUrl } from "../../api/endpoints";
import { findingLabel } from "../../lib/format";
import type { Assessment, ThesisRecord } from "../../api/schemas";

export default function DecisionPanel({
  record,
  latest,
  active,
  writing,
  pending,
  explanation,
  onExplanation,
  onKeep,
  onSetAside,
  onChangeConditions,
}: {
  record: ThesisRecord;
  latest: Assessment | null;
  active: boolean;
  writing: boolean;
  pending: boolean;
  explanation: string;
  onExplanation: (value: string) => void;
  onKeep: () => void;
  onSetAside: () => void;
  onChangeConditions: () => void;
}) {
  return (
    <section
      className="panel workspace-aside-card decision-panel"
      aria-labelledby="decision-title"
    >
      <span className="eyebrow">YOUR DECISION</span>
      <h2 id="decision-title">Record your decision</h2>
      <div className="decision-state">
        <span>Current evidence result</span>
        <strong className={latest?.state === "INVALIDATED" ? "negative" : ""}>
          {latest ? findingLabel(latest.state) : "No saved assessment"}
        </strong>
      </div>
      {active ? (
        <>
          <label>
            Why are you making this decision?
            <textarea
              value={explanation}
              onChange={(event) => onExplanation(event.target.value)}
              placeholder="Which sources matter, what remains uncertain, and why are you making this choice?"
              rows={4}
            />
          </label>
          <div className="actions journey-actions">
            <button
              type="button"
              disabled={writing || explanation.trim().length < 5}
              onClick={onKeep}
            >
              {pending ? "Saving…" : "Keep idea"}
            </button>
            <button
              type="button"
              className="danger"
              disabled={writing || explanation.trim().length < 5}
              onClick={onSetAside}
            >
              Set idea aside
            </button>
            <button type="button" onClick={onChangeConditions}>
              Change it instead
            </button>
          </div>
        </>
      ) : (
        <div className="callout">
          This idea has been set aside. Its history remains available.
        </div>
      )}
      <div className="export-block">
        <div>
          <h2>Take your research with you</h2>
          <p className="muted">
            Exports use saved data only and keep dates, citations, version
            history, and limitations.
          </p>
        </div>
        <div className="actions">
          <a
            className="button-link primary"
            href={exportThesisUrl(record.id, "pdf", record.version)}
            download
          >
            Download PDF
          </a>
          <a
            className="button-link"
            href={exportThesisUrl(record.id, "markdown", record.version)}
            download
          >
            Download Markdown
          </a>
          <a
            className="button-link"
            href={exportThesisUrl(record.id, "json", record.version)}
            download
          >
            Download JSON
          </a>
        </div>
      </div>
    </section>
  );
}
