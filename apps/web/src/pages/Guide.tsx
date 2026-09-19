import HowItWorksSteps from "../components/HowItWorksSteps";

export default function Guide() {
  return (
    <article className="static-page">
      <header className="static-hero">
        <span className="eyebrow">GUIDE</span>
        <h1>Use evidence to test a stock idea before you act.</h1>
        <p>
          Reviso is a private research notebook. It helps you write an idea,
          name what must stay true, compare that with a dated company filing,
          and keep the decision you make. It cannot place a trade.
        </p>
      </header>
      <section className="plain-content">
        <h2>What Reviso is for</h2>
        <p>
          A stock idea often lasts because nobody wrote what would make them
          reconsider. Reviso is for that written test. You stay responsible for
          the judgement. The app stores the reasoning, the source, and the
          choice you record.
        </p>
        <p>
          It is not a brokerage, a signal service, or a bot that decides for
          you. Tokenized Bitget products in this demo give economic exposure to
          a company. They are not registered shares in your name.
        </p>

        <h2>What you actually do</h2>
        <p>
          You choose one of six checked companies, write the idea in your own
          words, and confirm the conditions before the next result is saved. You
          then check a dated filing, read what is supported, challenged or
          missing, and choose to keep, change or set aside the idea.
        </p>
        <p>
          Only you can confirm conditions, record a decision or export a saved
          version. If Qwen is offline, you can still complete that path by hand.
        </p>
      </section>

      <section className="guide-how-it-works" id="how-it-works">
        <h2>How it works</h2>
        <p>
          From an idea to a clear decision: company, conditions, then the choice
          you record.
        </p>
        <HowItWorksSteps />
        <p>
          New research is a short path: choose a company, explain the idea, then
          review the conditions. Confirmation freezes that version. Later
          changes create a new version instead of rewriting what you previously
          believed.
        </p>
        <p>
          After confirmation the saved record is a workspace: idea, conditions,
          evidence and decision. The evidence result is a rules-based comparison
          with the filing. You still have to say what that result means for you.
        </p>
      </section>

      <section className="plain-content">
        <h2>What counts as evidence</h2>
        <p>
          Company conditions are checked against an official, allowlisted filing
          for that issuer. NVIDIA uses its newsroom earnings releases, with the
          matching SEC company-facts feed only if the primary path fails. Apple,
          Microsoft, Alphabet, Amazon and Tesla use issuer-bound SEC company
          facts. Historical NVIDIA replay is labeled as history and is not
          current evidence for a live check.
        </p>
        <p>
          Bitget supplies a dated USDT observation for the selected Reality
          token. xStocks may show a separate indicative USD price for the same
          company. That USD figure is comparison context only. It is not filing
          evidence, not a finding, and not a substitute for the Bitget quote.
          Missing numbers stay missing. Reviso does not invent a metric, treat
          an older report as a successful current check, or let an explanation
          overwrite the comparison.
        </p>

        <h2>What Qwen does</h2>
        <p>
          Sponsored Bitget Qwen 3.8 Max extracts and reviews a saved filing.
          Groq gpt-oss-20b can help draft editable conditions. Groq Qwen 3.8
          27B answers follow-up questions from that filing’s citations. The
          short explanation sits with the result and does not change it.
        </p>
        <p>
          These models cannot confirm conditions, fetch an arbitrary website,
          compute the financial result, record keep/change/set aside, or place
          a trade. Repair attempts count toward the daily allowance. This
          public page does not call them.
        </p>

        <h2>What is saved</h2>
        <p>
          Sign in with Google to keep a private library. Ideas, versions,
          evidence checks, conversations and decisions belong to your internal
          Reviso user id. Email is display data and does not merge accounts.
          Another signed-in person cannot open your record.
        </p>
        <p>
          You can export a saved version. The export uses only stored research.
          It is a record of your test, not investment advice and not proof that
          a token equals company shares.
        </p>
      </section>
      <nav className="plain-page-actions" aria-label="Guide next steps">
        <a className="button-link primary" href="/app">
          Open the research app
        </a>
      </nav>
    </article>
  );
}
