import { Link } from "react-router-dom";
import { CompanyLogo } from "../../components/Brand";
import { findingLabel, ideaTitle, money } from "../../lib/format";
import type {
  Assessment,
  Instrument,
  MarketObservation,
  ThesisRecord,
} from "../../api/schemas";

export default function RecordHeader({
  instrument,
  record,
  latest,
  market,
  marketLoading,
}: {
  instrument: Instrument;
  record: ThesisRecord;
  latest: Assessment | null;
  market: MarketObservation | null;
  marketLoading: boolean;
}) {
  const live =
    market?.availability === "AVAILABLE" && market.last_price ? market : null;
  const saved =
    latest?.market?.availability === "AVAILABLE" && latest.market.last_price
      ? latest.market
      : null;
  const price = live ?? saved;
  const status = record.retired
    ? { label: "Set aside", tone: "" }
    : latest
      ? {
          label: findingLabel(latest.state),
          tone: latest.state.toLowerCase(),
        }
      : { label: "Confirmed", tone: "" };

  return (
    <section className="record-header">
      <div className="record-header-identity">
        <CompanyLogo instrumentId={instrument.id} className="record-mark" />
        <div>
          <p className="record-kicker">
            {instrument.display_name} · {instrument.base_coin} / USDT · Bitget
          </p>
          <h1>{ideaTitle(record.thesis.rationale)}</h1>
          <p className="record-price">
            {marketLoading && !price
              ? "Checking the latest Bitget observation…"
              : price
                ? `Latest Bitget observation ${money(price.last_price)} USDT`
                : "Bitget price unavailable"}
            {price?.observed_at
              ? ` · ${new Date(price.observed_at).toLocaleString()}`
              : ""}
            {live ? "" : saved ? " · saved with this check" : ""}
          </p>
          <p className="caption">
            Tokenized exposure, not shares.{" "}
            <a href={instrument.terms_source} target="_blank" rel="noreferrer">
              Instrument terms
            </a>
          </p>
        </div>
      </div>
      <div className="record-header-meta">
        <span className={`badge ${status.tone}`}>{status.label}</span>
        <span className="version">v{record.version}</span>
        <Link className="button-link" to={`/app/thesis/${record.id}/timeline`}>
          Decision history
        </Link>
      </div>
    </section>
  );
}
