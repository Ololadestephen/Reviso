import type { EditableThesis } from "../../domain/defaults";

export default function IdeaComposer({
  value,
  onChange,
  locked,
}: {
  value: EditableThesis;
  onChange: (value: EditableThesis) => void;
  locked: boolean;
}) {
  const set = (key: keyof EditableThesis, entry: string | number) =>
    onChange({ ...value, [key]: entry });
  return (
    <fieldset disabled={locked} className="editor">
      <label className="full">
        Explain your idea in your own words
        <textarea
          value={value.rationale}
          onChange={(event) => set("rationale", event.target.value)}
          placeholder="Example: I think demand for this company can remain strong, but I would reconsider if revenue growth or margins weaken."
          rows={5}
        />
        <span className="field-help">
          Say why you are interested and what could make you reconsider. Reviso
          will turn this into editable conditions.
        </span>
      </label>
      <div className="input-grid risk-grid">
        <label>
          Amount you are considering · USDT
          <input
            type="number"
            min="1"
            step="any"
            value={value.proposed_amount}
            onChange={(event) => set("proposed_amount", event.target.value)}
            placeholder="1000"
          />
          <span className="field-help">A research input, not an order.</span>
        </label>
        <label>
          Price you are considering · USDT per token
          <input
            type="number"
            min="0.0000000001"
            step="any"
            value={value.entry_price}
            onChange={(event) => set("entry_price", event.target.value)}
            placeholder="Enter the price you want to study"
          />
          <span className="field-help">
            Reviso will not infer this from a quote.
          </span>
        </label>
        <label>
          Most you are prepared to lose · USDT
          <input
            type="number"
            min="0"
            step="any"
            value={value.max_loss}
            onChange={(event) => set("max_loss", event.target.value)}
            placeholder="100"
          />
          <span className="field-help">
            Used only in controlled stress tests.
          </span>
        </label>
        <label>
          Time horizon · days
          <input
            type="number"
            min="1"
            max="3650"
            value={value.holding_days}
            onChange={(event) =>
              set(
                "holding_days",
                event.target.value === "" ? "" : Number(event.target.value),
              )
            }
            placeholder="90"
          />
          <span className="field-help">
            How long this idea is meant to cover.
          </span>
        </label>
      </div>
      <details className="advanced-fields">
        <summary>More options</summary>
        <label>
          Maximum slippage used in the check · basis points
          <input
            type="number"
            min="0"
            value={value.max_slippage_bps}
            onChange={(event) => set("max_slippage_bps", event.target.value)}
            placeholder="100"
          />
          <span className="field-help">
            100 basis points equals 1%. This limit is used only when visible
            order-book depth is evaluated.
          </span>
        </label>
      </details>
    </fieldset>
  );
}
