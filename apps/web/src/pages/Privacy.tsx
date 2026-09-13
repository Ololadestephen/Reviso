export default function Privacy() {
  return (
    <article className="static-page narrow-static-page">
      <header className="static-hero">
        <span className="eyebrow">PRIVACY</span>
        <h1>What this demo saves and sends.</h1>
        <p>Plain information about the current Reviso release.</p>
      </header>
      <section className="plain-content">
        <h2>Saved research</h2>
        <p>
          The protected demo saves research ideas, conditions, evidence checks,
          questions and decisions in one server-side database. This release does
          not provide separate personal accounts.
        </p>
        <h2>AI requests</h2>
        <p>
          When you choose an AI action, the server sends the bounded research
          context needed for that action to the configured Qwen provider. It
          does not place credentials in the browser.
        </p>
        <h2>Public pages</h2>
        <p>
          The landing page, guide and prepared example do not read the saved
          research database and do not make Qwen requests.
        </p>
      </section>
    </article>
  );
}
