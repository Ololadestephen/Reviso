import type { XStocksContext } from "../../api/schemas";
import { money } from "../../lib/format";

export default function XStocksContextPanel({
  context,
  loading,
  embedded = false,
}: {
  context: XStocksContext | null;
  loading: boolean;
  embedded?: boolean;
}) {
  const live =
    context?.availability === "AVAILABLE" && context.indicative_price != null;
  return (
    <section
      className={`${embedded ? "" : "panel "}xstocks-context`}
      aria-labelledby="xstocks-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">Separate market context</span>
          <h2 id="xstocks-title">xStocks</h2>
        </div>
        {context?.xstock_symbol && (
          <span className="badge">{context.xstock_symbol}</span>
        )}
      </div>
      <p>
        Compare another tokenized product for the same company. It is not
        registered share ownership, does not count as company evidence, and
        cannot change Reviso’s finding.
      </p>
      {loading ? (
        <p className="muted">Loading xStocks context…</p>
      ) : live ? (
        <div className="xstocks-facts">
          <div>
            <span>Indicative USD price</span>
            <strong>
              {money(context.indicative_price)} {context.currency}
            </strong>
          </div>
          <div>
            <span>Trading status</span>
            <strong>
              {context.trading_halted
                ? "Halted"
                : context.market_open === true
                  ? "Open"
                  : context.market_open === false
                    ? "Closed"
                    : "Not reported"}
            </strong>
          </div>
          <div>
            <span>Networks reported</span>
            <strong>{context.networks.length || "Unavailable"}</strong>
          </div>
        </div>
      ) : (
        <p className="muted">
          xStocks context is unavailable. No price was substituted.
        </p>
      )}
      {context && (
        <>
          <p className="caption">
            Retrieved {new Date(context.retrieved_at).toLocaleString()} (Reviso
            fetch time; xStocks does not publish an observation time). This USD
            figure is not the selected Bitget USDT quote and is not a premium.
          </p>
          {context.limitations.length > 0 && (
            <ul className="caption">
              {context.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {context.warnings.map((item) => (
            <p className="caption" key={item}>
              {item}
            </p>
          ))}
          <div className="source-actions">
            <a href={context.source_url} target="_blank" rel="noreferrer">
              Official price source ↗
            </a>
            <a href={context.research_url} target="_blank" rel="noreferrer">
              xStocks website ↗
            </a>
          </div>
        </>
      )}
    </section>
  );
}
