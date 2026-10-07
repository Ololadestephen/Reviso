# Approved Gemini explanation check — 4 October 2026

## Result

**PASS for this one constructed case.** Gemini `gemini-3.5-flash-lite`
returned a validated explanation in **2.438 seconds**. The application action
took 2.446 seconds. **1 of 2 approved provider requests was used; no repair.**
The server budget ledger also recorded one user and one total request. Google
reported 1,076 prompt tokens and 413 completion tokens (1,489 total).

User approval: “free and run ai check its approved”. The credential was loaded
from ignored `.env` using the supported alias, never printed or written into
artifacts. Only public NVIDIA evidence and constructed conditions were sent.
No private notebook, account details, Groq/Bitget action or new public-source
request was part of the check. The free-tier key was not upgraded or enabled
for normal app traffic.

## Frozen case

`manifest.json` records the input and source-code fingerprints before the
request, the fixed Google endpoint/model, prompt version and two-request cap.
`STARTED` prevents accidental reuse. This case reuses the financial source
already retrieved in today's official-source validation packet; it does not
claim a new filing retrieval or an independently selected holdout.

The packet's NVIDIA quarter reports 106% year-over-year growth and 75% GAAP
gross margin. Constructed conditions require at least 120% growth, at least
75% margin, and manual research into whether demand exceeds every competitor.

| Condition | Saved numerical result | Gemini interpretation | Check |
| --- | --- | --- | --- |
| Growth at least 120% | INVALIDATED: reported 106% | CONTRADICTS | PASS |
| GAAP margin at least 75% | SUPPORTED: reported 75% | SUPPORTS | PASS |
| Demand stronger than every competitor | INSUFFICIENT_EVIDENCE | INSUFFICIENT_EVIDENCE | PASS |

The explanation is 39 words:

> The evidence shows 106% revenue growth and 75.0% GAAP gross margin for the quarter. Revenue growth is below the required 120% threshold, while gross margin meets its 75% target. Competitor demand comparisons remain unknown due to lack of evidence.

Both numerical items cite the supplied financial source. The peer item abstains
without inventing a source or substituting a numerical proxy. The explanation
matches the saved finding and makes no buy/sell recommendation. The next question
asks for projections and competitor metrics; those are questions, not claims
that such observations were supplied. Its wording could be made more useful by
asking for the next actual reported quarter, but no prompt was changed during
this frozen check.

## Application checks

- HTTP 200, schema and stance/citation checks passed on the first response.
- All saved condition states remained identical before and after the AI action.
- Repeating the same explanation action returned the saved output without
  spending another provider request.
- Provider/model/timing provenance was saved with the explanation.
- Restarting the isolated application with AI unavailable preserved assessment
  history and the explanation. JSON export preserved all research fields;
  only its download timestamp is regenerated.
- Budget accounting recorded exactly one request. The generated isolated
  notebook passed SQLite integrity checking.

The runner's final summary-bookkeeping call passed an extra date argument to
`Repository.llm_usage`. This happened after the live action, cache, restart and
export assertions passed. The summary was recovered from saved artifacts and
the isolated database offline, with no provider rerun. The exception is not
hidden or treated as a Gemini response failure.

## Limits and next gate

This is a smoke check of one explanation, not a general accuracy score, latency
benchmark, free-tier capacity guarantee or approval for public deployment.
It does not validate supplemental SEC/Fed/BLS explanation, drafting, chat,
adversarial prompts or the previous chat summary-citation concern.
Its latency must not be compared directly with the earlier 65.5-second Bitget
batch, which used different source context.

Normal app configuration remains unchanged: Gemini still requires explicit
review-provider selection. AWS, existing SQLite/accounts/secrets and Git history
were untouched; no commit, push or deployment was made.

Keep the free key to public/constructed demo inputs, not sensitive or confidential
research. Google's [API terms](https://ai.google.dev/gemini-api/terms) also require
Paid Services for clients offered to users in the EEA, Switzerland or UK. Confirm
the applicable data-use/region requirements before a public rollout; this check
is not consent to submit other users' information.

This turn changed only validation artifacts and documentation, so no new
Desloppify scan was needed. The prior local integration's full code checks and
all mechanical/unassessed subjective scores remain in the
[local verification](../2026-10-04-gemini-local.md). No subjective assessments or
code-health resolutions were invented.
