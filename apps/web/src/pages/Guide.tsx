import HowItWorksSteps from "../components/HowItWorksSteps";

function AiGuide() {
  return (
    <>
      <h2>What AI does</h2>
      <p>
        Sponsored Bitget Qwen 3.8 Max extracts ideas and explains saved filings
        by default. The server can instead use Gemini Flash-Lite for the
        explanation only. Groq gpt-oss-20b can help draft editable conditions.
        Groq Qwen 3.8 27B answers follow-up questions from saved sources and
        their citations. The short explanation sits with the result and does not
        change it.
      </p>
      <p>
        These models cannot confirm conditions, fetch an arbitrary website,
        compute the financial result, record keep/change/set aside, or place a
        trade. Repair attempts count toward the daily allowance. This public
        page does not call them.
      </p>
    </>
  );
}

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

        <h2>More research: company reports, Fed and BLS</h2>
        <p>
          Open More research on a current result to load three useful sources:
          the company's management discussion and risks, the latest available
          Fed interest-rate statement, and US inflation and jobs releases from
          BLS. Newer sources appear first. Each passage has a date and a link to
          the full document.
        </p>
        <p>
          This saves a new check using your existing financial filing, not new
          filing numbers or a fresh price. Your previous check stays saved.
          Company statements are not independent proof; economy-wide releases
          cannot confirm a company condition or fill a missing number. These are
          selected openings, not complete reports. A source may be blocked, too
          old or in a format Reviso cannot read; its status is shown.
        </p>
        <p>
          Loading sources does not call AI. You can then ask the chat about
          them, or choose Explain with these sources for a new explanation.
          Those AI actions use your allowance. Historical examples and test
          scenarios do not load today's releases. BLS release pages can change,
          so their saved availability starts when Reviso retrieved them.
        </p>

        <h2>Related reading from xStocks</h2>
        <p>
          The result page also offers a small selection of dated xStocks
          research links. Company mentions are labelled separately from wider
          market topics, with newer articles first. Older checks do not show
          articles published after their evidence date.
        </p>
        <p>
          These links open on xStocks. Reviso does not read or summarise the
          articles, and they are not used in your finding or filing chat. This
          is a manually checked reading list, not an automatic news feed. The
          separate xStocks price remains under Advanced view → Market details.
        </p>

        <AiGuide />

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
