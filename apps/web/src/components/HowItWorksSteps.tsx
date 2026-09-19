import { CompanyLogo } from "./Brand";

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
    copy: "Explain why you are interested and what could make you reconsider. Get help writing your idea.",
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

export default function HowItWorksSteps() {
  return (
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
  );
}
