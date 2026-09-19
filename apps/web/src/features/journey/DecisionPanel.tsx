import { useEffect, useState } from "react";
import { exportThesisUrl } from "../../api/endpoints";
import { findingLabel } from "../../lib/format";
import {
  conditionsNamed,
  defaultConditionCall,
  type ConditionCall,
} from "../../lib/conditionHonesty";
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
  onKeep: (calls: Record<string, ConditionCall>) => void;
  onSetAside: (calls: Record<string, ConditionCall>) => void;
  onChangeConditions: (calls: Record<string, ConditionCall>) => void;
}) {
  const rows = latest
    ? latest.assumptions.map((item) => {
        const claim =
          record.thesis.assumptions.find(
            (assumption) => assumption.id === item.assumption_id,
          )?.claim ?? item.assumption_id;
        return {
          id: item.assumption_id,
          claim,
          state: item.state,
        };
      })
    : [];
  const [calls, setCalls] = useState<Record<string, ConditionCall>>({});

  useEffect(() => {
    setCalls(
      Object.fromEntries(
        (latest?.assumptions ?? []).map((item) => [
          item.assumption_id,
          defaultConditionCall(item.state),
        ]),
      ),
    );
  }, [latest?.input_hash]);

  const ready =
    explanation.trim().length >= 5 &&
    conditionsNamed(
      rows.map((item) => item.id),
      calls,
    );

  return (
    <section
      className="panel workspace-aside-card decision-panel"
      aria-labelledby="decision-title"
    >
      <span className="eyebrow">YOUR DECISION</span>
      <h2 id="decision-title">Keep, set aside, or change it</h2>
      <p className="nav-label">
        {latest
          ? `Evidence result is ${findingLabel(latest.state)}`
          : "No saved assessment"}
      </p>
      <p className="decision-lead">
        The filing result stays on the left. Name which conditions still hold
        before you record what you are doing with the idea.
      </p>
      {active ? (
        <>
          {rows.length > 0 && (
            <div className="decision-conditions">
              {rows.map((item) => (
                <fieldset key={item.id} className="decision-condition">
                  <legend>{item.claim}</legend>
                  {(
                    [
                      ["held", "Still holds"],
                      ["broke", "Did not hold"],
                      ["missing", "Missing"],
                    ] as const
                  ).map(([value, label]) => (
                    <label key={value} className="check">
                      <input
                        type="radio"
                        name={`condition-${item.id}`}
                        checked={calls[item.id] === value}
                        onChange={() =>
                          setCalls((current) => ({
                            ...current,
                            [item.id]: value,
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          )}
          <label>
            Why this choice?
            <textarea
              value={explanation}
              onChange={(event) => onExplanation(event.target.value)}
              placeholder="One sentence: why the idea still exists or dies."
              rows={3}
            />
          </label>
          <div className="actions journey-actions">
            <button
              type="button"
              disabled={writing || !ready}
              onClick={() => onKeep(calls)}
            >
              {pending ? "Saving…" : "Keep idea"}
            </button>
            <button
              type="button"
              className="danger"
              disabled={writing || !ready}
              onClick={() => onSetAside(calls)}
            >
              Set idea aside
            </button>
            <button
              type="button"
              disabled={writing || !ready}
              onClick={() => onChangeConditions(calls)}
            >
              Change it instead
            </button>
          </div>
        </>
      ) : (
        <div className="callout">
          This idea has been set aside. Its history remains available.
        </div>
      )}
      <details className="export-block">
        <summary>Download this version</summary>
        <p className="muted">
          Exports use saved data only and keep dates, citations, version
          history, and limitations.
        </p>
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
      </details>
    </section>
  );
}
