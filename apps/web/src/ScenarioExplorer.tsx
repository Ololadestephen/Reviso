import { useState } from "react";
import { money } from "./lib/format";
import type { Assessment, Numerical } from "./api/schemas";
import type { StressScenario } from "./queries/workspace";

interface Props {
  disabled: boolean;
  pending: boolean;
  initial: Numerical | null;
  scenario?: Assessment["scenario"];
  onRun: (scenario: StressScenario) => Promise<Numerical>;
}

export default function ScenarioExplorer({
  disabled,
  pending,
  initial,
  scenario,
  onRun,
}: Props) {
  const [move, setMove] = useState(scenario?.price_move_pct ?? "-10");
  const [spread, setSpread] = useState(scenario?.spread_bps ?? "20");
  const [depth, setDepth] = useState(scenario?.depth_multiplier ?? "1");
  const [result, setResult] = useState<Numerical | null>(null);

  async function run() {
    try {
      setResult(
        await onRun({
          price_move_pct: move,
          spread_bps: spread,
          depth_multiplier: depth,
          fee_bps: "0",
          bids: [
            { price: "100", quantity: "60" },
            { price: "99", quantity: "30" },
          ],
        }),
      );
    } catch {
      // The workspace error banner already reports the failed mutation.
    }
  }

  const shown = result ?? initial;
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">02 / TEST THE LIMITS</span>
          <h2>What breaks the trade?</h2>
        </div>
        <span className="badge amber">Controlled scenario</span>
      </div>
      <p className="muted">
        Hypothetical prices and visible book. No historical fill or probability
        claim.
      </p>
      <div className="sliders">
        <label>
          Price move <strong>{move}%</strong>
          <input
            type="range"
            min="-50"
            max="10"
            value={move}
            onChange={(e) => setMove(e.target.value)}
          />
        </label>
        <label>
          Additional spread <strong>{spread} bps</strong>
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={spread}
            onChange={(e) => setSpread(e.target.value)}
          />
        </label>
        <label>
          Visible depth <strong>{depth}×</strong>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={depth}
            onChange={(e) => setDepth(e.target.value)}
          />
        </label>
      </div>
      <button disabled={disabled || pending} onClick={run}>
        {pending ? "Calculating…" : "Run stress test"}
      </button>
      {shown && (
        <>
          <div className="result-grid">
            <div>
              <span>Price-only P&L · USDT</span>
              <strong className={shown.loss_breach ? "negative" : ""}>
                {money(shown.price_pnl)}
              </strong>
            </div>
            <div>
              <span>First tested loss breach</span>
              <strong>
                {shown.breaking_move_pct === null
                  ? "None found"
                  : `${shown.breaking_move_pct}%`}
              </strong>
            </div>
          </div>
          {shown.execution && (
            <div className="execution">
              <p>
                Visible-book exit:{" "}
                <strong>
                  {money(shown.execution.filled_quantity)} tokens filled
                </strong>{" "}
                · {money(shown.execution.remainder)} unfilled
              </p>
              <p>
                VWAP {money(shown.execution.vwap)} USDT · slippage{" "}
                {money(shown.execution.slippage_bps)} bps
              </p>
              {!shown.execution.full_position_evaluable && (
                <p className="negative">
                  Insufficient visible depth. Full-position exit P&L is
                  unavailable.
                </p>
              )}
            </div>
          )}
          <details>
            <summary>Scenario bounds, costs and missing reference</summary>
            <p>{shown.search}</p>
            <p>{shown.costs}</p>
            <p>{shown.premium_reason}</p>
          </details>
        </>
      )}
    </section>
  );
}
