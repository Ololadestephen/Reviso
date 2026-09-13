import { money } from "./lib/format";
import type { Instrument, MarketObservation } from "./api/schemas";

export default function MarketPanel({
  market,
  instrument,
}: {
  market: MarketObservation;
  instrument: Instrument;
}) {
  return (
    <div className="market-observation">
      <div className="ledger-heading">
        <strong>Bitget · {instrument.base_coin} / USDT</strong>
        <span className="badge">Live observation</span>
      </div>
      <p>
        {market.availability === "AVAILABLE"
          ? `Last observed price: ${money(market.last_price)} USDT`
          : "Market observation unavailable. No prices substituted."}
      </p>
      {market.observed_at && (
        <p className="caption">
          Observed {new Date(market.observed_at).toLocaleString()} · retrieved{" "}
          {new Date(market.retrieved_at).toLocaleString()}
        </p>
      )}
      <p className="caption">
        This saved snapshot becomes stale; refresh before using it. It does not
        alter historical replay prices.
      </p>
      <details>
        <summary>Provider warnings and provenance</summary>
        {market.warnings.map((warning, index) => (
          <p key={index}>{warning}</p>
        ))}
        <a href={instrument.terms_source} target="_blank" rel="noreferrer">
          Instrument representation terms ↗
        </a>
      </details>
    </div>
  );
}
