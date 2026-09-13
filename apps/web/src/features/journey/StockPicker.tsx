import type { Instrument, InstrumentId } from "../../api/schemas";
import { CompanyLogo } from "../../components/Brand";

export default function StockPicker({
  instruments,
  loading,
  selected,
  onSelect,
}: {
  instruments: Instrument[];
  loading: boolean;
  selected: InstrumentId | "";
  onSelect: (id: InstrumentId) => void;
}) {
  return (
    <section
      className="panel journey-panel"
      aria-labelledby="choose-stock-title"
    >
      <span className="eyebrow">STEP 1 OF 5</span>
      <h1 id="choose-stock-title">Which company are you researching?</h1>
      <p className="lead">
        Choose one of the companies with verified Bitget market identity and
        public quarterly evidence coverage.
      </p>
      {loading ? (
        <p role="status" className="empty">
          Loading supported companies…
        </p>
      ) : (
        <div className="stock-grid">
          {instruments.map((instrument) => (
            <button
              type="button"
              className={`stock-card ${selected === instrument.id ? "selected" : ""}`}
              aria-pressed={selected === instrument.id}
              key={instrument.id}
              onClick={() => onSelect(instrument.id)}
            >
              <CompanyLogo
                instrumentId={instrument.id}
                className="stock-symbol"
              />
              <span>
                <strong>{instrument.display_name}</strong>
                <small>
                  {instrument.base_coin} / {instrument.quote_currency}
                </small>
                <small>
                  Quarterly filings
                  {instrument.historical_replay_available
                    ? " · older evidence example"
                    : " · current research"}
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="callout">
        These are tokenized exposures traded on Bitget. They are not registered
        shares in your name and may have different eligibility, liquidity, and
        redemption terms.
      </div>
    </section>
  );
}
