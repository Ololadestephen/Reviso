import { Link } from "react-router-dom";
import { CompanyLogo } from "../components/Brand";
import CitedNvidiaExample from "../components/CitedNvidiaExample";

const steps = [
  {
    number: "01",
    title: "Choose a company",
    copy: "Start with one of the six checked names. Each already has a Bitget market identity and an official evidence path.",
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
    title: "Name what would change your mind",
    copy: "Write the idea in your words, then the conditions that must stay true. You can type them or ask Qwen to propose editable ones.",
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
    title: "Read the filing, then decide",
    copy: "Reviso checks the dated source against those conditions. Qwen explains the result. You keep, change, or set aside the idea.",
    visual: (
      <img
        className="step-screen-image"
        src="/step-check-idea.svg"
        alt="Reviso screen showing cited evidence and a recorded decision"
      />
    ),
  },
];

const roles = [
  {
    title: "You",
    body: "Pick the company, confirm the conditions, open the source, and record keep / change / set aside. The decision is always yours.",
  },
  {
    title: "Qwen",
    body: "Suggests editable conditions and explains a saved filing with citations. It cannot change the numerical result or confirm the idea.",
  },
  {
    title: "Reviso never",
    body: "Places a trade, invents a missing number, or treats an older report as a successful current check.",
  },
];

export default function Guide() {
  return (
    <article className="static-page">
      <header className="static-hero">
        <span className="eyebrow">REVISO GUIDE</span>
        <h1>How a research session works.</h1>
        <p>
          Reviso is a workbench for one idea at a time. You write the
          conditions, check a dated company filing, then record your decision.
        </p>
      </header>

      <section className="guide-walkthrough">
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

      <section className="example-check" aria-labelledby="cited-example-title">
        <p className="guide-example-lead">
          The NVIDIA walkthrough is the concrete case: a 75% margin floor
          against a 74.6% print.
        </p>
        <CitedNvidiaExample sourceToExample />
      </section>

      <section className="guide-roles">
        {roles.map((item) => (
          <article key={item.title}>
            <h2>{item.title}</h2>
            <p>{item.body}</p>
          </article>
        ))}
      </section>

      <p className="guide-next">
        <Link to="/example">Open the prepared NVIDIA example</Link>
        {" · "}
        <a href="/app">Start in the research app</a>
      </p>
    </article>
  );
}
