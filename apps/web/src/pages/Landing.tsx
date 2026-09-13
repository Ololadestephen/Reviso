import { Link } from "react-router-dom";
import { CompanyLogo } from "../components/Brand";
import ProductPreview from "../components/ProductPreview";

const steps = [
  {
    number: "01",
    title: "Pick a company",
    copy: "Start with NVIDIA, Apple or Microsoft. Each one has a checked Bitget market identity and official company evidence.",
    visual: (
      <div className="step-stock-cards" aria-hidden="true">
        <CompanyLogo instrumentId="RNVDAUSDT" />
        <CompanyLogo instrumentId="RAAPLUSDT" />
        <CompanyLogo instrumentId="RMSFTUSDT" />
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

export default function Landing() {
  return (
    <>
      <section className="public-hero">
        <div className="hero-copy">
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
        <article className="cited-example-card">
          <header>
            <div>
              <span className="eyebrow">EXAMPLE · NVIDIA · FY2025 Q3</span>
              <h2 id="cited-example-title">One condition, one dated print.</h2>
            </div>
            <span className="badge invalidated">Invalidated</span>
          </header>
          <dl>
            <div>
              <dt>Condition</dt>
              <dd>GAAP gross margin stays at or above 75%</dd>
            </div>
            <div>
              <dt>Reported</dt>
              <dd>74.6% in the third-quarter release</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>
                <Link to="/example">
                  NVIDIA investor relations excerpt · available 21 Nov 2024
                </Link>
              </dd>
            </div>
          </dl>
          <p className="cited-example-note">
            This is a dated research example, not a current view or a
            recommendation. Open the source in the walkthrough.
          </p>
        </article>
      </section>

      <section className="coverage-section">
        <div>
          <span className="eyebrow">CURRENT COVERAGE</span>
          <h2>Start with three checked companies.</h2>
          <p>
            Each company is matched to a specific tokenized exposure on Bitget
            and a bounded official evidence source.
          </p>
        </div>
        <div className="company-list">
          <article>
            <CompanyLogo instrumentId="RNVDAUSDT" />
            <div>
              <strong>NVIDIA</strong>
              <small>rNVDA / USDT</small>
            </div>
          </article>
          <article>
            <CompanyLogo instrumentId="RAAPLUSDT" />
            <div>
              <strong>Apple</strong>
              <small>rAAPL / USDT</small>
            </div>
          </article>
          <article>
            <CompanyLogo instrumentId="RMSFTUSDT" />
            <div>
              <strong>Microsoft</strong>
              <small>rMSFT / USDT</small>
            </div>
          </article>
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
