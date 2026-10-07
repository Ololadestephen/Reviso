# xStocks research: links now, content only with permission

## Implemented locally

The result page has a compact **Related research · xStocks** reading list outside
Advanced view. Two relevant links appear first, with remaining reading under
More reading. Company-specific links are restricted to the named company;
wider-market links are labelled. Dates are newest first. Date-only publication
is gated to the next UTC day, so no article newer than the saved check date is
shown. If nothing qualifies, the section is absent.

This is a manually checked reading list, not an automatic feed. Links open on
the publisher's website without sending the idea, thesis ID or referrer. Topic
labels are Reviso's, not copied headlines. No article body, preview, image or PDF
is fetched by Reviso. Links do not enter company evidence, the finding, Qwen
explanations, filing chat or exports. Existing immutable research is unchanged.

The indicative xStocks USD price remains under Advanced view → Market details,
separate from Bitget USDT. The market API and lazy loading are unchanged. Its old
research button is removed so research is no longer presented as a price feature.

## Reading checked on 4 October 2026

Dates and topics were checked manually on these publisher pages. Full-report
PDF links exist there but were not downloaded/indexed. Linking does not verify
the publisher's market claims or turn forecasts into reported company facts.

| Date | Reviso topic label | Selection |
| --- | --- | --- |
| 29 September 2026 | [Interest rates and Tesla delivery dates](https://xstocks.fi/news/us-10-year-yields-top-5-as-micron-earnings-and-tesla-deliveries-set-the-tone-for-growth-equities) | Tesla only |
| 22 September 2026 | [Interest rates and geopolitical risks](https://xstocks.fi/news/investors-eye-geopolitical-tensions-as-the-fed-raises-rates) | Wider market |
| 15 September 2026 | [Rates and AI-sector uncertainty](https://xstocks.fi/news/investors-weigh-the-fomc-decision-as-geopolitical-tension-and-ai-development-slowdown-risks-collide) | Wider market |
| 8 September 2026 | [Inflation, jobs and Apple's product event](https://xstocks.fi/news/investors-await-critical-cpi-report-after-hot-jobs-report) | Apple only |

Other companies receive labelled wider-market reading, not invented
company-specific reports. Publication date is not event date. This list may
become outdated and does not promise the latest available article.

## Content-permission gate

The linked [website terms](https://xstocks.fi/documents/xstocks-terms-of-service.pdf),
sections 3 and 6, restrict retrieval/indexing and reuse. Public readability is
not treated as a licence for automated ingestion or sending copied reports to
models. No research-content API/licence has been verified. Market metadata API
access is not assumed to grant article rights.

Before ingestion, obtain written permission or a licensed feed covering article
and PDF retrieval/retention, excerpts, summaries, app/export display, attribution,
sending authorised text to Bitget/Groq, caching/refresh limits,
deletions/corrections and geographical/access conditions.

### Draft enquiry — not sent

> Hello xStocks team,
>
> We are building Reviso, a research notebook for the Bitget AI Base Camp
> hackathon. People write an idea, check official company reports and save their
> own decision. Reviso cannot place trades.
>
> We currently link to a few relevant xStocks articles. We would like to add
> dated, cited market context inside the notebook, separate from company facts.
>
> Do you offer a research feed or written permission to retrieve articles and
> full-report PDFs, retain approved excerpts, and use Bitget/Groq models to
> summarise them and answer cited questions? Please share the permitted display,
> export, attribution, retention, geographical and rate-limit conditions. We
> will not automate content collection without permission.
>
> Project: https://github.com/Ololadestephen/Reviso

The user can send this through the contact form on the official
[xStocks website](https://xstocks.fi/news). No contact, account authorisation or
message was made by this work.

## Next slice, after permission

1. Separate typed market-commentary provider/contract. Only approved endpoints
   and exact report links; no arbitrary URL or broadly allowed PDF CDN. Bound
   size, type, timeout and redirects.
2. Save publisher, publication/availability/retrieval dates, approved excerpt,
   period/topic, URL, hash and limitations. Bind issuer mentions, label macro
   context, filter by check date and keep immutable snapshots.
3. Supply authorised commentary in separately labelled, cited explanation/chat
   context. Include snapshot hashes in cache keys. New articles must not rewrite
   old answers; external text remains untrusted data.
4. Distinguish facts, opinion, forecasts and unknowns. Commentary cannot fill a
   missing GAAP number, automatically pass a manual condition, create a price
   shock, override the Decimal finding or decide for the human.
5. Offline tests for issuer/time isolation, stale/duplicate/missing reports, PDF
   failures, injection, phantom citations and cache/version boundaries. Then a
   separately approved capped AI batch and separately approved publication.

These links are not substitutes for the independent pilot's official-source
packets. That pilot stays separate from both market commentary and the user study.
