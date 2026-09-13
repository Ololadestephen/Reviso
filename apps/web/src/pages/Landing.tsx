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

const features = [
  [
    "01",
    "Clear conditions",
    "Turn a broad idea into statements you can check later.",
  ],
  [
    "02",
    "Original sources",
    "Open the company release or filing behind every cited finding.",
  ],
  [
    "03",
    "Honest gaps",
    "See when evidence is missing, old, incomplete or in conflict.",
  ],
  [
    "04",
    "Questions with citations",
    "Ask about saved evidence and get answers tied to its sources.",
  ],
  [
    "05",
    "Saved history",
    "Later changes make a new version and keep the earlier one readable.",
  ],
  [
    "06",
    "Simple downloads",
    "Save the complete research record as Markdown or structured JSON.",
  ],
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
            Write down your idea, check company reports, and decide whether to
            keep it, change it or set it aside.
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
          <ProductPreview />
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
          <p>Five guided steps, grouped into three simple parts.</p>
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

      <section className="platform-section">
        <div className="platform-heading">
          <span className="eyebrow">ONE RESEARCH RECORD</span>
          <h2>
            One idea.
            <span>Every source. Every decision.</span>
          </h2>
          <p>
            Your conditions, sources, questions and decisions stay connected to
            the saved version they came from.
          </p>
        </div>
        <div className="platform-grid">
          <div
            className="platform-art"
            role="img"
            aria-label="A visual map from an idea to evidence and a decision"
          >
            <div className="platform-stock">
              <CompanyLogo instrumentId="RNVDAUSDT" />
              <div>
                <strong>NVIDIA research</strong>
                <small>Saved version 2</small>
              </div>
              <em>IN REVIEW</em>
            </div>
            <div className="idea-block">
              <small>YOUR IDEA</small>
              <strong>What do I expect?</strong>
            </div>
            <div className="platform-line" aria-hidden="true" />
            <div className="evidence-block">
              <small>CITED EVIDENCE</small>
              <strong>What do the sources show?</strong>
            </div>
            <div className="platform-line" aria-hidden="true" />
            <div className="decision-block">
              <small>YOUR DECISION</small>
              <strong>Keep · Change · Set aside</strong>
            </div>
          </div>
          <div className="platform-cells">
            <article>
              <span aria-hidden="true">✎</span>
              <h3>Define the idea</h3>
              <p>Write what you expect and how long the idea should last.</p>
            </article>
            <article>
              <span aria-hidden="true">◇</span>
              <h3>Set the conditions</h3>
              <p>
                Decide what must stay true and where your view should change.
              </p>
            </article>
            <article>
              <span aria-hidden="true">↗</span>
              <h3>Inspect the sources</h3>
              <p>Read the company evidence, its date and its limits.</p>
            </article>
            <article>
              <span aria-hidden="true">✓</span>
              <h3>Record your choice</h3>
              <p>
                Save your reason and return to it when the evidence changes.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="public-section" id="features">
        <div className="public-section-heading">
          <span className="eyebrow">WHAT YOU CAN DO</span>
          <h2>Everything needed to revisit an idea.</h2>
        </div>
        <div className="feature-grid">
          {features.map(([number, title, copy]) => (
            <article key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="walkthrough-section">
        <div className="walkthrough-copy">
          <span className="eyebrow">PRODUCT WALKTHROUGH</span>
          <h2>Start with the answer. Then inspect the path behind it.</h2>
          <p>
            Reviso shows the result first. Open any finding to see its source,
            date, measured value and missing information.
          </p>
          <Link className="text-link" to="/example">
            Walk through the NVIDIA example →
          </Link>
        </div>
        <ProductPreview compact />
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
        <h2>Ready to test your stock idea?</h2>
        <p>Write it down, check the evidence, and decide what to do next.</p>
        <a className="button-link final-cta-button" href="/app">
          Open the research app
        </a>
      </section>
    </>
  );
}
