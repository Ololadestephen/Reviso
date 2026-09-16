import { Link } from "react-router-dom";
import { CompanyLogo } from "../components/Brand";
import HowItWorksSteps from "../components/HowItWorksSteps";
import ProductPreview from "../components/ProductPreview";

const coveredCompanies = [
  { instrumentId: "RNVDAUSDT", name: "NVIDIA", pair: "rNVDA / USDT" },
  { instrumentId: "RAAPLUSDT", name: "Apple", pair: "rAAPL / USDT" },
  { instrumentId: "RMSFTUSDT", name: "Microsoft", pair: "rMSFT / USDT" },
  { instrumentId: "RGOOGLUSDT", name: "Alphabet", pair: "rGOOGL / USDT" },
  { instrumentId: "RAMZNUSDT", name: "Amazon", pair: "rAMZN / USDT" },
  { instrumentId: "RTSLAUSDT", name: "Tesla", pair: "rTSLA / USDT" },
] as const;

export default function Landing() {
  return (
    <>
      <section className="public-hero">
        <div className="hero-copy">
          <p className="hero-announcement">
            Bitget AI Base Camp Season 2<span aria-hidden="true"> · </span>
            <Link to="/example">NVIDIA example</Link>
          </p>
          <h1>
            Have a stock idea?
            <span>See if the evidence supports it.</span>
          </h1>
          <p>
            An idea often lasts because nobody wrote what would make them
            reconsider. Write the conditions, check the filing, then decide.
          </p>
          <div className="hero-actions">
            <a className="button-link hero-primary" href="/app">
              Start my research
            </a>
          </div>
        </div>
        <div className="hero-preview-wrap">
          <ProductPreview live />
        </div>
        <div className="hero-proof" aria-label="Reviso product boundaries">
          <span>Public company evidence</span>
          <span>Bitget market data</span>
          <span>Human-controlled decisions</span>
          <span>No trade execution</span>
        </div>
      </section>

      <section className="public-section" id="how-it-works">
        <div className="public-section-heading centered">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>From an idea to a clear decision.</h2>
          <p>Company, conditions, decision.</p>
        </div>
        <HowItWorksSteps />
      </section>

      <section className="coverage-section">
        <div>
          <span className="eyebrow">CURRENT COVERAGE</span>
          <h2>Start with six checked companies.</h2>
          <p>
            Each company is matched to a specific tokenized exposure on Bitget
            and a bounded official evidence source.
          </p>
        </div>
        <div className="company-list">
          {coveredCompanies.map((company) => (
            <article key={company.instrumentId}>
              <CompanyLogo instrumentId={company.instrumentId} />
              <div>
                <strong>{company.name}</strong>
                <small>{company.pair}</small>
              </div>
            </article>
          ))}
        </div>
        <p className="coverage-note">
          These products provide tokenized exposure. They are not registered
          shares in your name and can have different rules, access and
          liquidity.
        </p>
      </section>

      <section className="final-cta">
        <h2>Write the condition before the print.</h2>
        <p>
          If you already know what would change your mind, Reviso will check it
          against a dated source. If you don’t, that’s the work.
        </p>
        <a className="button-link final-cta-button" href="/app">
          Open the research app
        </a>
        <small>You confirm. Reviso does not trade.</small>
      </section>
    </>
  );
}
