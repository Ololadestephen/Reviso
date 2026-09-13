import ProductPreview from "../components/ProductPreview";

const exampleSteps = [
  {
    number: "1",
    title: "Company",
    body: "NVIDIA, researched through the verified rNVDA / USDT market identity.",
  },
  {
    number: "2",
    title: "Idea",
    body: "Data-centre demand can remain strong over the chosen research period.",
  },
  {
    number: "3",
    title: "Conditions",
    body: "Revenue growth and reported margin stay above levels chosen by the researcher.",
  },
  {
    number: "4",
    title: "Evidence",
    body: "A dated company release is checked. Any condition without a reported measure stays open.",
  },
  {
    number: "5",
    title: "Decision",
    body: "The researcher records keep, change or set aside, together with their reason.",
  },
];

export default function Example() {
  return (
    <article className="static-page example-page">
      <header className="static-hero">
        <span className="eyebrow">READ-ONLY EXAMPLE · NO AI CALLS</span>
        <h1>See how an NVIDIA idea moves through Reviso.</h1>
        <p>
          This prepared walkthrough explains the process. Its wording is
          illustrative and is not a current market view or recommendation.
        </p>
      </header>

      <ProductPreview />

      <section className="example-journey" aria-label="Five example steps">
        {exampleSteps.map((step) => (
          <article key={step.number}>
            <span>{step.number}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="example-sources">
        <div>
          <span className="eyebrow">SOURCE BOUNDARIES</span>
          <h2>What the real app checks</h2>
        </div>
        <div>
          <p>
            Current company evidence comes from a bounded official NVIDIA
            disclosure path. Market observations come from the allowlisted
            Bitget instrument.
          </p>
          <p>
            Reviso keeps reported facts, older replay evidence and “what if”
            calculations visibly separate.
          </p>
        </div>
      </section>

      <section className="example-next">
        <h2>Ready to write your own idea?</h2>
        <p>
          The editable app is protected because this demo uses one shared
          research store.
        </p>
        <a className="button-link primary" href="/app">
          Open the protected app
        </a>
      </section>
    </article>
  );
}
