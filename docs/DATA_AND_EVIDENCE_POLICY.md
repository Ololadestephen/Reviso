# Data and evidence policy v1

Every source records publisher, URL, relevant excerpt, publication/observation/retrieval times, instrument/company scope, content hash, duplicate family and limitations. Publication time is distinct from retrieval. When only a date is known, evidence becomes available at the next UTC day (conservative day-level gate); no invented intraday timestamp.

Historical company disclosures support only the named period and metric. They do not establish current conditions, price forecasts or token representation terms. Headlines cannot override a primary filing. Replay data never enters a live assessment as current evidence. Controlled scenarios are hypothetical and not probability estimates.

SUPPORTED means available evidence supports the specific claim. INVALIDATED requires a confirmed condition and suitable evidence satisfying it. CHALLENGED requires material contradiction short of the condition. Missing/stale/ambiguous evidence produces INSUFFICIENT_EVIDENCE while previous assessments remain stored.

Aggregation: essential INVALIDATED first; then essential CHALLENGED; then any essential INSUFFICIENT_EVIDENCE; otherwise SUPPORTED. Supporting warnings remain visible, with no averaged score. Recovery creates another assessment, retaining the prior result and explanation.

Numerical policy: long-only, costs declared, observed depth not guaranteed liquidity. Reference premiums require matching underlying, currency, unit conversion and synchronized timestamps. No compatible reference means unavailable, never zero premium. Price, spread and depth shocks are independent controls; qualitative news never creates a price shock automatically.

xStocks is a separate tokenized product for the same six companies. Reviso fetches only the exact public asset and price-data URLs on `https://api.xstocks.fi`, with no redirects, a 500 KB JSON limit, a 10-second read timeout and a 4-second connect timeout. Successful snapshots cache for five minutes and unavailable results for 30 seconds. The quote is indicative USD context only: it is never filing evidence, never a finding, never substituted for the selected Bitget USDT observation, and is not a claim of share ownership. xStocks does not publish an observation time; `retrieved_at` is Reviso’s fetch time. The xStocks website is linked for the visitor and is not fetched by the server.

The result page also offers manually curated xStocks research links, newest first within the selected company/wider-market scope and conservatively gated to the saved check date. These are outward links with Reviso's topic labels, not retrieved articles, archived evidence or model input. They cannot change the finding and are not included in chat/export. The dated list does not claim automatic freshness. Website/PDF ingestion and AI summaries remain subject to content permission; see [the research integration boundary](XSTOCKS_RESEARCH.md).

Source text is untrusted input. Fetch only fixed approved provider hosts/paths, with timeout, response size limit and bounded retry; do not follow redirects to arbitrary destinations. Credentials and private rationales are excluded from routine logs. Google sign-in verifies ID tokens only at `https://oauth2.googleapis.com/tokeninfo` for the configured web client ID. Email is display data; Google `sub` is the identity key.

Optional Gemini explanations use only the fixed Google compatible endpoint
`https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`.
The server accepts `Gemini_API` or `GEMINI_API_KEY`, but a key does not activate
the route: `REVISO_REVIEW_PROVIDER=gemini` is required. Bounded confirmed
conditions, saved finding and selected excerpts are model input, never account
credentials. Minimal reasoning, structured output, local validation and shared
AI allowances apply; transport errors do not retry or fall back to Bitget.
Before public activation, confirm the applicable Google billing/data-use tier
and update disclosures as necessary. Free-tier input may be used to improve
Google products. Google sign-in and Gemini access are separate configurations.

Public NVIDIA retrieval uses only the fixed newsroom financial-results listing and exact financial-results release path pattern. It makes at most two requests per uncached primary refresh, rejects all redirects, limits each decoded HTML response to 2 MB, and applies HTTP timeouts plus a 25-second retrieval budget. Successful results are cached for five minutes and failures for 30 seconds. When the primary path is unavailable, the exact NVIDIA SEC company-facts URL may recover issuer-bound facts; this is labeled retrieval redundancy, not independent corroboration. There are no automatic retries or older-report fallbacks. Availability remains day-gated; reports older than 120 days cannot satisfy current numerical assumptions.

The parser accepts the reported-quarter introduction and the current-quarter column of a table explicitly headed GAAP. It does not use non-GAAP tables or guidance. Ambiguous/missing metrics are omitted. Excerpts, publication date, period ended, retrieval timestamp, parser version and hashes are saved inside immutable assessments, so later source changes cannot rewrite previous decisions. The excerpt hash covers normalized extracted text; the document hash covers decoded received HTML. Full HTML is not archived. Public retrieval never expands the fixed historical replay corpus.

Apple and Microsoft current evidence uses only the exact allowlisted SEC company-facts URLs for their registered CIKs. Responses must match both CIK and issuer name. The parser accepts filed 10-Q/10-K quarterly USD duration facts with explicit calendar-quarter frames, compatible 70–105 day periods and filing dates no later than retrieval. Revenue growth requires the aligned prior-year quarter; gross margin requires gross profit aligned to the same current revenue period. Partial metrics remain absent, a stale latest aligned period is labeled stale, and a wrong issuer fails closed. Payloads are JSON-only, redirect-free and limited to 12 MB; caches are isolated by instrument.

Follow-up answers can cite only evidence IDs from the selected saved assessment. User questions and evidence excerpts are untrusted model data. Answers separate reported facts, explanation and uncertainty, and remain attached to the original thesis version and assessment hash after later evidence arrives. Source lookup for saved excerpts is limited to assessments owned by the signed-in user. Bundled NVIDIA replay documents remain a public catalog. Export includes only saved research fields through the requested version; it never includes credentials, headers, server paths or unrelated theses and never triggers a provider call.
# Optional official research — 2026-10-04

SEC report excerpts, Fed policy statements and BLS inflation/jobs releases are
stored separately in `research_sources`, with empty metric maps. Company report
statements are not independent validation; macro context cannot establish a
company condition. They never enter the Decimal metric-comparison engine.
Only explicit loading on a LIVE_REFRESH result is supported. It creates a new
immutable check and re-evaluates the saved numerical evidence at a new cutoff;
old checks are not enriched with future information. This is not a fresh filing
or quote. BLS mutable release pages have availability no earlier than retrieval.
Source IDs, excerpt/document hashes, parser version, publication/reference and
retrieval dates, scope, limitations and failures are saved. Selected openings
are not full-document research. AI and chat use labelled excerpts and validated
citation IDs; macro-only citations cannot support/contradict company conditions.
No new paid validation has been performed for this prompt revision.
