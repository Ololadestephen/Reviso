import { CompanyLogo } from "../components/Brand";
import CitedNvidiaExample from "../components/CitedNvidiaExample";
import ProductPreview from "../components/ProductPreview";

const walkthrough = [
  {
    number: "01",
    title: "Pick NVIDIA",
    copy: "The walkthrough uses the verified rNVDA / USDT market identity, not a guessed ticker.",
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
    title: "Write the idea",
    copy: "The researcher said data-centre demand can remain strong, then named what would change their mind.",
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
    title: "Check the print",
    copy: "A dated company release is compared with those conditions. Margin at 74.6% did not hold a 75% floor.",
    visual: (
      <img
        className="step-screen-image"
        src="/step-check-idea.svg"
        alt="Reviso screen showing cited evidence and a recorded decision"
      />
    ),
  },
];

export default function Example() {
  return (
    <article className="static-page example-page">
      <header className="static-hero">
        <span className="eyebrow">READ-ONLY EXAMPLE · NO AI CALLS</span>
        <h1>An NVIDIA idea, checked against one dated filing.</h1>
        <p>
          This prepared walkthrough shows the same path as the app: company,
          conditions, print, decision. The wording is illustrative and is not a
          current market view or recommendation.
        </p>
      </header>

      <ProductPreview />

      <section className="example-check" aria-labelledby="cited-example-title">
        <CitedNvidiaExample />
      </section>

      <section className="example-walkthrough">
        <div className="public-section-heading centered">
          <span className="eyebrow">THE PATH</span>
          <h2>Company, conditions, then a dated print.</h2>
        </div>
        <div className="steps-grid">
          {walkthrough.map((step) => (
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

      <section className="example-next">
        <h2>Write your own idea in the app.</h2>
        <p>
          The editable app is protected because this demo uses one shared
          research store. The example above does not call Qwen or load live
          filings.
        </p>
        <a className="button-link primary" href="/app">
          Open the protected app
        </a>
      </section>
    </article>
  );
}
