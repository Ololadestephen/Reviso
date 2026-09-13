import { conditionText } from "./lib/format";
import type { Assumption } from "./api/schemas";
import type { EditableThesis } from "./domain/defaults";

interface Props {
  value: EditableThesis;
  onChange: (value: EditableThesis) => void;
  locked: boolean;
}

function manualAssumption(existing: Assumption[]): Assumption {
  let index = existing.length + 1;
  while (existing.some((item) => item.id === `claim-${index}`)) index += 1;
  return {
    id: `claim-${index}`,
    claim: "",
    category: "fundamental",
    essential: true,
    metric: "manual",
    minimum: "0",
    invalidation_condition:
      "Requires manual evidence review; no numerical invalidation rule.",
  };
}

export default function ThesisEditor({ value, onChange, locked }: Props) {
  const update = (index: number, next: Assumption) =>
    onChange({
      ...value,
      assumptions: value.assumptions.map((item, itemIndex) =>
        itemIndex === index ? next : item,
      ),
    });

  return (
    <fieldset disabled={locked} className="editor">
      <p className="muted">
        Read and edit every condition. Any number shown here is a boundary you
        choose, not a forecast from Reviso.
      </p>
      {value.assumptions.length === 0 && (
        <div className="empty assumption-empty">
          No conditions yet. Ask Qwen for editable suggestions or add one
          yourself.
        </div>
      )}
      {value.assumptions.map((assumption, index) => (
        <article className="assumption-edit" key={assumption.id}>
          <span className="index">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <label>
              What needs to stay true?
              <input
                value={assumption.claim}
                onChange={(event) =>
                  update(index, { ...assumption, claim: event.target.value })
                }
              />
            </label>
            <div className="condition-row">
              <label>
                Evidence measure
                <select
                  value={assumption.metric}
                  onChange={(event) => {
                    const metric = event.target.value as Assumption["metric"];
                    update(index, {
                      ...assumption,
                      metric,
                      minimum: metric === "manual" ? "0" : assumption.minimum,
                      invalidation_condition: conditionText(
                        metric,
                        metric === "manual" ? "0" : assumption.minimum,
                      ),
                    });
                  }}
                >
                  <option value="gaap_margin_pct">GAAP gross margin</option>
                  <option value="revenue_growth_yoy_pct">
                    Revenue growth compared with last year
                  </option>
                  <option value="manual">Qualitative · manual research</option>
                </select>
                <span className="field-help">
                  {assumption.metric === "gaap_margin_pct"
                    ? "The share of reported revenue left after cost of revenue."
                    : assumption.metric === "revenue_growth_yoy_pct"
                      ? "Reported quarterly revenue compared with the same period one year earlier."
                      : "Reviso records this claim but will not invent a numerical test."}
                </span>
              </label>
              {assumption.metric !== "manual" && (
                <label>
                  Reconsider below · %
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    step="0.1"
                    value={assumption.minimum}
                    onChange={(event) =>
                      update(index, {
                        ...assumption,
                        minimum: event.target.value,
                        invalidation_condition: conditionText(
                          assumption.metric,
                          event.target.value,
                        ),
                      })
                    }
                  />
                  <span className="field-help">
                    The boundary you choose for changing your view.
                  </span>
                </label>
              )}
            </div>
            <p className="confirmation-rule">
              <strong>What would change your mind:</strong>{" "}
              {assumption.invalidation_condition}
            </p>
            <div className="assumption-actions">
              <label className="check">
                <input
                  type="checkbox"
                  checked={assumption.essential}
                  onChange={(event) =>
                    update(index, {
                      ...assumption,
                      essential: event.target.checked,
                    })
                  }
                />
                This is essential to my idea
              </label>
              <button
                type="button"
                className="quiet danger"
                onClick={() =>
                  onChange({
                    ...value,
                    assumptions: value.assumptions.filter(
                      (_, itemIndex) => itemIndex !== index,
                    ),
                  })
                }
              >
                Remove
              </button>
            </div>
          </div>
        </article>
      ))}
      <button
        type="button"
        disabled={locked || value.assumptions.length >= 12}
        onClick={() =>
          onChange({
            ...value,
            assumptions: [
              ...value.assumptions,
              manualAssumption(value.assumptions),
            ],
          })
        }
      >
        ＋ Add a condition
      </button>
    </fieldset>
  );
}
