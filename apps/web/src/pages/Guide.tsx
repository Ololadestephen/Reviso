const guideItems = [
  [
    "Research idea",
    "Your own explanation of why a company interests you and how long the view should last.",
  ],
  [
    "Condition",
    "Something that needs to stay true. A condition can use a reported measure or require manual research.",
  ],
  [
    "What would change my mind",
    "The point where you decide the idea needs another look. You choose this boundary.",
  ],
  [
    "Company evidence",
    "A dated excerpt from an allowlisted company source. The source and limits stay visible.",
  ],
  [
    "What if?",
    "A controlled calculation using values you choose. It is separate from observed evidence.",
  ],
  [
    "Saved version",
    "A fixed copy of the idea and conditions you confirmed. Later edits create another version.",
  ],
];

export default function Guide() {
  return (
    <article className="static-page">
      <header className="static-hero">
        <span className="eyebrow">REVISO GUIDE</span>
        <h1>Simple words for careful research.</h1>
        <p>
          Reviso helps you write an idea, decide what would change your mind,
          inspect evidence and save your decision.
        </p>
      </header>
      <section className="guide-grid">
        {guideItems.map(([title, body]) => (
          <article key={title}>
            <h2>{title}</h2>
            <p>{body}</p>
          </article>
        ))}
      </section>
      <section className="plain-content">
        <h2>What Qwen can do</h2>
        <p>
          Qwen can suggest editable conditions and explain saved evidence with
          citations. You can complete the full process manually when it is
          unavailable.
        </p>
        <h2>What Reviso cannot do</h2>
        <p>
          Reviso cannot confirm an idea, record a decision or place a trade for
          you. Missing evidence stays missing, and an older report is not shown
          as a successful current check.
        </p>
      </section>
    </article>
  );
}
