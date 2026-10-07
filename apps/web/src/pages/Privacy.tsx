export default function Privacy() {
  return (
    <article className="static-page narrow-static-page">
      <header className="static-hero">
        <span className="eyebrow">PRIVACY</span>
        <h1>What this demo saves and sends.</h1>
        <p>Plain information about the current Reviso release.</p>
      </header>
      <section className="plain-content">
        <h2>Accounts</h2>
        <p>
          The research app uses Google sign-in. Google’s stable account
          identifier is stored so you can return to your own notebook. Email is
          display data only and is never used to merge accounts. A later login
          method can be added to the same internal user; matching emails do not
          combine libraries.
        </p>
        <h2>Saved research</h2>
        <p>
          Ideas, conditions, evidence checks, AI explanations, follow-up chats
          and decisions are stored in the server database under your internal
          user ID. Another signed-in person cannot read that record. Existing
          demo research created before accounts remains operator-owned until it
          is explicitly linked.
        </p>
        <h2>AI requests</h2>
        <p>
          When you choose an AI action, the server sends the bounded research
          context needed for that action to the configured AI provider. Bitget
          Qwen or Groq handles idea extraction; Groq handles drafting and chat.
          The explanation can use the primary provider or, if enabled on the
          server, Google Gemini. It does not place credentials in the browser.
          Per-account and total daily allowances apply, including repair
          attempts. Saved findings stay readable if an allowance runs out.
        </p>
        <p>
          Adding a Gemini key alone does not enable it. Google's free-tier terms
          may allow submitted content to be used to improve its products. The
          operator must confirm the applicable tier and data terms before
          enabling it for other people's research. See{" "}
          <a
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noreferrer"
          >
            Google's Gemini API terms
          </a>
          .
        </p>
        <h2>Public pages</h2>
        <p>
          The landing page, guide and prepared example do not read the saved
          research database and do not make AI requests. Public company filings
          and market snapshots can use a shared cache; your notebook does not.
        </p>
        <h2>Account picture</h2>
        <p>
          The illustrated face on the account control is generated in the
          browser from DiceBear Fun Emoji artwork by Davis Uche (CC BY 4.0). The
          account id is used only as a local seed and is not sent to DiceBear.
        </p>
      </section>
    </article>
  );
}
