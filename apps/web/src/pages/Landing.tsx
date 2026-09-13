import { Link } from "react-router-dom";
import { CompanyLogo } from "../components/Brand";
import CitedNvidiaExample from "../components/CitedNvidiaExample";
import ProductPreview from "../components/ProductPreview";

const steps = [
  {
    number: "01",
    title: "Pick a company",
    copy: "Choose from six familiar companies. Each one has a checked Bitget market identity and official company evidence.",
    visual: (
      <div className="step-stock-cards" aria-hidden="true">
        <CompanyLogo instrumentId="RNVDAUSDT" />
        <CompanyLogo instrumentId="RGOOGLUSDT" />
        <CompanyLogo instrumentId="RTSLAUSDT" />
      </div>
    ),
  },
  {
    number: "02",
    title: "Write your idea",
    copy: "Explain why you are interested and what could make you reconsider. You can write the conditions yourself or ask Qwen for help.",
    visual: (
      <img
        className="step-screen-image"
        src="/step-write-idea.svg"
        alt="Reviso screen for writing an NVIDIA research idea"
      />
    ),
  },
  {
    number: "03",
    title: "Check and decide",
    copy: "Read the dated sources, see what is missing, then record whether you want to keep, change or set aside the idea.",
    visual: (
      <img
        className="step-screen-image"
        src="/step-check-idea.svg"
        alt="Reviso screen showing cited evidence and a recorded decision"
      />
    ),
  },
];

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
            <Link to="/example">View the NVIDIA example →</Link>
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
            <Link className="button-link hero-primary" to="/example">
              Try the example
            </Link>
            <a className="button-link hero-secondary" href="/app">
              Start my research
            </a>
          </div>
          <small>You make the decision. Reviso cannot place trades.</small>
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
        <div className="steps-grid">
          {steps.map((step) => (
            <article
              className={`landing-step step-${step.number}`}
              key={step.number}
            >
              <div className="step-visual">{step.visual}</div>
              <span className="step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="public-section cited-example"
        aria-labelledby="cited-example-title"
      >
        <CitedNvidiaExample sourceToExample />
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
