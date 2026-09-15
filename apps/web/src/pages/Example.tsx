const secondQuarterUrl =
  "https://investor.nvidia.com/news/press-release-details/2024/NVIDIA-Announces-Financial-Results-for-Second-Quarter-Fiscal-2025/default.aspx";
const thirdQuarterUrl =
  "https://investor.nvidia.com/news/press-release-details/2024/NVIDIA-Announces-Financial-Results-for-Third-Quarter-Fiscal-2025/default.aspx";

export default function Example() {
  return (
    <article className="static-page narrow-static-page">
      <header className="static-hero">
        <span className="eyebrow">READ-ONLY EXAMPLE · NO AI OR API CALLS</span>
        <h1>One NVIDIA idea, two dated filings, and a human decision.</h1>
        <p>
          This is a complete written case from Reviso’s historical NVIDIA
          replay. It does not fetch a live filing, load a market quote, or call
          Qwen. The figures are illustrative history, not a current view or a
          recommendation.
        </p>
      </header>
      <section className="plain-content">
        <h2>The researcher and the instrument</h2>
        <p>
          The researcher wants NVIDIA economic exposure through rNVDA / USDT on
          Bitget, the Reality instrument Reviso has verified for this company.
          That product is tokenized exposure. It is not a registered NVIDIA
          share in the researcher’s name, and this case does not prove
          redemption, liquidity or ownership equivalence.
        </p>
        <p>
          Company evidence below tests the business idea. The Bitget quote is
          not used as a filing, and a separate xStocks USD price would not be
          allowed to change the finding.
        </p>

        <h2>The idea and the conditions</h2>
        <p>
          The researcher’s idea is that NVIDIA can keep delivering strong
          reported performance. Before looking at the next print, they confirm
          two measurable conditions:
        </p>
        <ul>
          <li>Reported GAAP gross margin stays at or above 75%.</li>
          <li>Reported year-over-year revenue growth stays at or above 80%.</li>
        </ul>
        <p>
          Those floors are the researcher’s test, not a Reviso recommendation.
          Confirming them freezes this version. Changing a floor later would
          create a new version and leave this one in the history.
        </p>

        <h2>First filing: both conditions hold</h2>
        <p>
          NVIDIA’s fiscal 2025 second-quarter release reported a 75.1% GAAP
          gross margin and revenue growth of 122% from a year earlier. In this
          replay the source becomes available on 29 August 2024.
        </p>
        <ul>
          <li>Margin: 75.1% is at least 75% — supported.</li>
          <li>Growth: 122% is at least 80% — supported.</li>
        </ul>
        <p>
          <a href={secondQuarterUrl} target="_blank" rel="noreferrer">
            Open NVIDIA’s fiscal 2025 second-quarter release ↗
          </a>
        </p>
        <p>
          At this point the researcher could keep the idea, with the cited
          passage stored against this version. Nothing in Reviso treats
          “supported” as an instruction to buy.
        </p>

        <h2>Second filing: the result is mixed</h2>
        <p>
          NVIDIA’s fiscal 2025 third-quarter release reported a 74.6% GAAP gross
          margin and revenue growth of 94% from a year earlier. In this replay
          the source becomes available on 21 November 2024.
        </p>
        <ul>
          <li>Margin: 74.6% is below 75% — invalidated.</li>
          <li>Growth: 94% is still at least 80% — supported.</li>
        </ul>
        <p>
          <a href={thirdQuarterUrl} target="_blank" rel="noreferrer">
            Open NVIDIA’s fiscal 2025 third-quarter release ↗
          </a>
        </p>
        <p>
          Reviso checks each confirmed condition on its own numbers. One missed
          floor does not rewrite the other comparison, and the earlier
          second-quarter assessment remains in the history.
        </p>

        <h2>What Qwen may add, and what it may not</h2>
        <p>
          In the live app, Qwen can explain this mixed result in shorter
          language and point at the saved excerpts. It cannot change 74.6 versus
          75, cannot fetch a different source for this page, and cannot choose
          keep, revise or set aside. This example contains no Qwen output
          because the page never calls it.
        </p>

        <h2>What the researcher must do</h2>
        <p>
          After reading the cited print, the researcher has to decide. Keep the
          idea if they still accept the remaining growth condition and the
          broken margin floor. Change the conditions, with a written reason, if
          they want a new version. Set the idea aside if the missed margin floor
          is enough.
        </p>
        <p>
          Reviso does not pick among those answers. If the 75% floor is later
          revised, the original condition and its invalidated result stay
          attached to this version so the next decision can be compared with
          what was actually written before the new evidence arrived.
        </p>

        <h2>What this case does not prove</h2>
        <p>
          It shows timestamped evidence, exact comparisons, a mixed finding and
          an unchanged history. It does not show that rNVDA tracks NVIDIA
          shares, that the token can be redeemed, or that any of those human
          choices would have made money.
        </p>
      </section>
      <nav className="plain-page-actions" aria-label="Example next steps">
        <a className="button-link primary" href="/app">
          Continue with Google
        </a>
      </nav>
    </article>
  );
}
