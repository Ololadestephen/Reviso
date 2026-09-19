import { useRef, useState } from "react";
import type { EditableThesis } from "../../domain/defaults";
import type { MarketObservation } from "../../api/schemas";
import { money } from "../../lib/format";
import { examplesFor } from "./ideaExamples";

export default function IdeaComposer({
  value,
  onChange,
  locked,
  market = null,
  marketLoading = false,
}: {
  value: EditableThesis;
  onChange: (value: EditableThesis) => void;
  locked: boolean;
  market?: MarketObservation | null;
  marketLoading?: boolean;
}) {
  const area = useRef<HTMLTextAreaElement>(null);
  const examples = examplesFor(value.instrument_id);
  const [pending, setPending] = useState<(typeof examples)[number] | null>(
    null,
  );
  const set = (key: keyof EditableThesis, entry: string | number) =>
    onChange({ ...value, [key]: entry });

  function applyExample(text: string) {
    onChange({ ...value, rationale: text });
    setPending(null);
    area.current?.focus();
  }

  function chooseExample(example: (typeof examples)[number]) {
    const current = value.rationale.trim();
    if (current && current !== example.text) {
      setPending(example);
      return;
    }
    applyExample(example.text);
  }

  return (
    <fieldset disabled={locked} className="editor">
      <label className="full">
        Explain your idea in your own words
        <textarea
          ref={area}
          value={value.rationale}
          onChange={(event) => {
            setPending(null);
            set("rationale", event.target.value);
          }}
          placeholder="Example: I think demand for this company can remain strong, but I would reconsider if revenue growth or margins weaken."
          rows={5}
        />
        <span className="field-help">
          Say why you are interested and what could make you reconsider. Reviso
          will turn this into editable conditions.
        </span>
      </label>
      {examples.length > 0 && (
        <div className="idea-examples" role="group" aria-label="Try an example">
          <p>Try an example</p>
          <p className="field-help">
            Starting points, not your own words. They stay editable after they
            appear in the box.
          </p>
          <div className="suggestion-row">
            {examples.map((example) => (
              <button
                type="button"
                key={example.label}
                aria-pressed={value.rationale === example.text}
                onClick={() => chooseExample(example)}
              >
                {example.label}
              </button>
            ))}
          </div>
          {pending && (
            <div className="example-replace" role="status">
              <p>
                {pending.label} would replace what you already wrote. This
                example is a starting point, not your own words.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => applyExample(pending.text)}
                >
                  Replace with this example
                </button>
                <button type="button" onClick={() => setPending(null)}>
                  Keep what I wrote
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
        <div className="field-group">
          <label htmlFor="entry-price">
            Price you are considering · USDT per token
          </label>
          <div className="entry-price-row">
            <input
              id="entry-price"
              type="number"
              min="0.0000000001"
              step="any"
              value={value.entry_price}
              onChange={(event) => set("entry_price", event.target.value)}
              placeholder="Enter the price you want to study"
            />
            {market?.availability === "AVAILABLE" && market.last_price ? (
              <div className="entry-price-quote" aria-live="polite">
                <span>Bitget {money(market.last_price)} USDT</span>
                <button
                  type="button"
                  onClick={() =>
                    set("entry_price", market.last_price as string)
                  }
                >
                  Use this price
                </button>
              </div>
            ) : marketLoading ? (
              <span className="entry-price-quote muted" aria-live="polite">
                Checking Bitget…
              </span>
            ) : null}
          </div>
          <span className="field-help">
            Your research input. Reviso will not replace it automatically.
          </span>
        </div>
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
