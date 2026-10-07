# Official research sources

Reviso offers three optional source groups under **More research** on a live
result. Loading these makes no AI call and sends no private idea or account data
to a source provider.

## What is loaded

1. **Company report:** SEC submissions identify the selected company's latest
   available 10-Q or 10-K matching the period of the saved numerical filing.
   Selected openings of management discussion and risk factors are extracted.
   A short table-of-contents entry is rejected; ambiguous sections abstain.
   Missing sections are reported, not replaced with an older period. If the live
   numerical filing is missing, a latest report can supply commentary only.
   NVIDIA and Microsoft have explicitly verified `CORP` name variants in the
   submissions index, scoped to their exact CIKs; no general company-suffix
   rewriting or fuzzy name match is used. Report-body identity checks remain.
2. **Fed policy:** the official monetary-policy RSS feed identifies the newest
   available FOMC statement. Its dated document supplies a selected opening.
   Feed and document publication dates must agree.
3. **Inflation and jobs:** BLS CPI and Employment Situation official summary pages
   (`cpi.nr0.htm` and `empsit.nr0.htm`, without the large tables) supply
   selected openings, publication time in America/New_York and reference month.
   They are not transformed into financial metrics. Since current pages may be
   revised, saved availability is no earlier than retrieval.

Sources are sorted newest first. All excerpts are capped at 1,800 characters;
AI receives at most 720 characters per source. Open the full source before making
claims about what the entire report contains. A missing passage is not proof that
the full report omitted the topic. Company statements are not independently
verified. Fed/BLS material is economy-wide context, not company performance.

## Setup and operation

No API key is needed. SEC expects an identifying User-Agent. In server `.env`,
set `REVISO_SEC_USER_AGENT` to your application name plus a real contact address.
Use an address you control, including a personal email; no work-email account is
required. Restart the backend after changing configuration. Never put secrets
in the frontend or share them in chat. With no contact configured this provider
reports SEC unavailable; it does not invent one.

One uncached load makes at most six public GET requests: SEC index/report, Fed
feed/statement, and two BLS releases. Three provider groups run concurrently;
cache updates coalesce concurrent loads. Macro snapshots are shared across
issuers. Success/partial caches last 15 minutes; total failures last 30 seconds.
Cache storage is bounded and old entries expire. No retry loop or redirect is
followed. BLS may return 403 in some environments; this is displayed, not bypassed.

Approved URLs are generated from registered issuer CIKs and validated SEC index
filenames, or exact official Fed/BLS paths. The request accepts a selected-check
hash, never a URL. Decoded documents have size/time bounds; executable/hidden
HTML is discarded, and XML entity/DOCTYPE declarations are rejected. UTF-8 and
known content types are required. Changed or unrecognized formats abstain.
SEC archive reports have a 10 MB decoded limit; other documents remain at 1 MB.
The per-document wall budget remains 20 seconds. Parser `official-passages-v2`
requires named Item headings; repeated bare Item page headers are not section
boundaries. Ambiguous named sections still abstain.

Company reports older than 120 days and macro releases older than 62 days are
not attached. These are retrieval policies, not research-quality guarantees.
Read the full source for previous periods and context.

## Saved state and AI

The authenticated, CSRF-protected POST `/theses/{id}/research-context` accepts
`assessment_input_hash`. Only a selected LIVE_REFRESH check on a confirmed active
idea can load sources. Selection and version are compared again inside the save
transaction. A concurrent change produces 409 instead of replacing the new
selection. Another user's record or source returns 404.

Loading saves a **new** check with a new cutoff. It rechecks the saved filing's
age but does not refresh the filing or market quote. Previous checks and thesis
versions remain immutable. No database migration is needed; sources and provider
statuses are fields in the existing saved assessment JSON. Source lookup, JSON,
Markdown and PDF exports read saved owner-scoped data without fetching providers.

`research_sources` is distinct from numerical `evidence`; supplementary sources
must have empty metrics. Qwen review v5 and question v4 receive labelled sources,
selected conditions and the authoritative saved comparison. Citation IDs must
come from that saved set. Macro-only citations cannot support or contradict a
company assumption. Company commentary cannot substitute for a missing engine
number. Actual source relevance and explanation accuracy still require judgement.
One bounded repair retains the same source boundaries and counts toward budgets.

Changed passages or source roles change the narrative context and chat thread.
Retrieval timestamps alone do not invalidate the explanation cache. Loading does
not auto-run a paid explanation; choose **Explain with these sources** or send a
chat question. Old explanations/threads remain attached to their old saved check.

## Validation boundary

Offline MockTransport tests exercise all six issuer mappings, dates, revision
availability, parser failures, source isolation, bounded transport, immutable
saves, restart, citation sets and exports. These are software boundary tests,
not an independent research study or broad live model benchmark. The approved
three-action frozen check of review v5 / question v4 used 3/6 requests, with no
repairs. Contracts, cached repeats, restart and export persistence passed. Manual
inspection found incomplete summary citation coverage in one company answer;
reply-length ambiguity and boilerplate-heavy excerpts also remain. See the
[live report](evaluations/official-ai-2026-10-04/REPORT.md). This is not a clean
research-quality pass or a substitute for independent validation.

Primary references: [SEC APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces),
[SEC fair access](https://www.sec.gov/about/developer-resources),
[Fed feeds](https://www.federalreserve.gov/feeds/feeds.htm),
[BLS CPI release](https://www.bls.gov/news.release/cpi.htm),
[BLS jobs release](https://www.bls.gov/news.release/empsit.htm).
