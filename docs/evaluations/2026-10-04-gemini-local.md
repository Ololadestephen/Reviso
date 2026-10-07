# Gemini explanation integration — local verification

## Outcome and activation gate

The ignored `.env` contains a non-empty `Gemini_API` value. It was checked only
as a boolean; the credential was not printed, copied into source, sent to a
provider or committed. `GEMINI_API_KEY` is the standard supported name and wins
if both names are supplied. Existing process variables still override `.env`.

Gemini is opt-in for explanations only. A key alone does not switch providers.
After confirming Google's data-use tier and authorizing a bounded live test,
select `REVISO_REVIEW_PROVIDER=gemini` and restart the backend using its
documented `--env-file .env` command. Until then the prior route stays selected.
This does not change Google sign-in, Groq drafting/chat or idea extraction.
Configured means a key exists, not that Google accepted it.

The adapter uses Google's fixed OpenAI-compatible endpoint, the fixed
`gemini-3.5-flash-lite` model, structured JSON, minimal reasoning and a
10-second network timeout per provider request. It shares Reviso's existing
contract, citation and saved-numerical-result validation, one-repair boundary,
daily/concurrency limits and provider/model/prompt-keyed review cache. Errors
do not fall back to Bitget. This timeout is not a wall-clock guarantee or a
measured latency result. Saved explanations keep their original provenance.

Google documents [structured output and compatible requests](https://ai.google.dev/gemini-api/docs/openai)
and [minimal thinking for this model](https://ai.google.dev/gemini-api/docs/thinking).
Review [Google's data terms](https://ai.google.dev/gemini-api/terms) before
enabling the free tier for other people's research. No search/grounding tool,
arbitrary URL, new SDK dependency or frontend secret was added.

Google's terms require Paid Services when offering API clients to users in the
EEA, Switzerland or UK, and forbid sending sensitive/confidential/personal data
to Unpaid Services. Public activation must account for these restrictions, not
just whether a free quota remains. Privacy/Guide copy now names the optional
provider and links the terms; no claim of consent or billing verification is made.

## Verification

- 216 backend tests passed; 18 new tests/cases cover alias priority, opt-in,
  missing/invalid configuration, structured requests, one repair, malformed,
  truncated/refused and non-JSON responses, HTTP/rate-limit/timeouts, secret-safe
  errors, separate route readiness, caching, provenance and adapter closure.
- 121 frontend tests passed, including separate explanation readiness when
  extraction is unavailable, and disabled explanation when only extraction is
  configured. Backward-compatible status responses remain supported.
- Ruff check and formatting passed for backend/tests/scripts. Prettier source
  and test checks passed. TypeScript and the production build passed.
- OpenAPI snapshot regenerated; `git diff --check` passed.
- Existing dependency deprecation and bundle-size warnings remain. No dependency
  installation or warning suppression was done.

Initial frontend verification caught a new test supplying null where the
existing contract requires an omitted explanation, plus an outdated Guide
heading assertion. Both were corrected; the complete suite then passed.
The final rescan also flagged the Guide's enlarged function. Its provider/AI
explanation was extracted into the cohesive `AiGuide` section in the same file;
no content was hidden or excluded from the scan.

No live Gemini request, paid call, production change, commit or push was made.
Tests use mocked provider transports and temporary databases; existing research
is untouched. Speed, free-tier availability, key validity and real answer
quality still require a separately approved live check. The previous live
batch's summary-citation coverage concern is not fixed by changing providers.

## Desloppify

The installed skill guided separate backend and `apps/web` scans, with status
and next before/after implementation. Dependency/build/cache exclusions were
unchanged. No subjective assessments, suppressions or resolutions were invented.
The project plan explicitly defers the independent subjective review.

| Project | Overall before → after | Objective before → after | Strict before → after | Verified before → after | Open before → after |
| --- | --- | --- | --- | --- | --- |
| Backend | 23.0 → 23.1 | 92.0 → 92.4 | 22.0 → 22.1 | 92.0 → 92.4 | 83 → 81 |
| Web | 21.9 → 21.9 | 87.8 → 87.8 | 20.5 → 20.5 | 87.8 → 87.8 | 72 → 72 |

All mechanical dimension scores (health / strict):

| Dimension | Backend before | Backend after | Web before | Web after |
| --- | --- | --- | --- | --- |
| Code quality | 88.8 / 84.9 | 89.2 / 85.4 | 97.1 / 95.5 | 97.1 / 95.3 |
| Duplication | 100 / 100 | 100 / 100 | 100 / 100 | 100 / 100 |
| File health | 86.0 / 83.7 | 86.5 / 84.2 | 98.8 / 98.8 | 98.8 / 98.8 |
| Security | 97.3 / 95.3 | 99.0 / 95.5 | 100 / 100 | 100 / 100 |
| Test health | 87.5 / 78.0 | 87.8 / 78.4 | 57.8 / 37.3 | 57.6 / 37.2 |

The remaining backend security findings are the existing Bitget bridge
subprocess warnings B404/B603. No change to that bridge was made. Scanner
aggregation changed with the new module; these scores are not evidence that
this task fixed those risks. Remaining structural, test-health and code-quality
findings were not expanded into a repository cleanup. The cross-project
“queue cycle” comparison emitted by the tool is not a web regression; compare
each project only with its own baseline above.
The new Guide size finding was resolved in the final rescan. Small web
dimension-ratio changes remain as shown, with the same 72 open findings and
unchanged aggregate scores; no subjective score or test coverage claim is made
from this aggregate result.

All subjective dimensions remain unassessed (scanner value zero), before and
after, in both projects. These zeros are not judgments of design quality:

| Subjective dimension | Backend | Web |
| --- | --- | --- |
| Abstraction fit | 0, unassessed | 0, unassessed |
| AI-generated debt | 0, unassessed | 0, unassessed |
| API coherence | 0, unassessed | 0, unassessed |
| Authorization consistency | 0, unassessed | 0, unassessed |
| Contracts | 0, unassessed | 0, unassessed |
| Convention outlier | 0, unassessed | 0, unassessed |
| Cross-module architecture | 0, unassessed | 0, unassessed |
| Dependency health | 0, unassessed | 0, unassessed |
| Design coherence | 0, unassessed | 0, unassessed |
| Error consistency | 0, unassessed | 0, unassessed |
| High elegance | 0, unassessed | 0, unassessed |
| Incomplete migration | 0, unassessed | 0, unassessed |
| Initialization coupling | 0, unassessed | 0, unassessed |
| Logic clarity | 0, unassessed | 0, unassessed |
| Low elegance | 0, unassessed | 0, unassessed |
| Mid elegance | 0, unassessed | 0, unassessed |
| Naming quality | 0, unassessed | 0, unassessed |
| Package organization | 0, unassessed | 0, unassessed |
| Test strategy | 0, unassessed | 0, unassessed |
| Type safety | 0, unassessed | 0, unassessed |

These are code-health measures, not hackathon grades or research-accuracy scores.
