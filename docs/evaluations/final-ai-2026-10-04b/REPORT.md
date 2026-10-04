# Final approved live AI check — October 4, 2026

## Scope

User approval: final live check, commit/push and SQLite backup. Three user-level AI actions; at most six provider requests including repairs. Only constructed NVIDIA research and bundled, clearly historical FY2025 Q2/Q3 excerpts were submitted. No Google sign-in, user study, live market retrieval, trading, publishing or AWS deployment was performed.

`manifest.json` freezes the inputs, expected checks and source hashes before execution. The runner refuses changed sources and a previously started directory. `requests.json` records every attempted provider request before network access, including repairs, with response/usage/time but never credentials or headers. `results.json` and `persistence.json` preserve application outputs.

An earlier frozen attempt in `../final-ai-2026-10-04` stopped at HTTP 401 because local `.env` selected Google sign-in. **Zero provider requests** were made. Its STARTED marker and failed result remain untouched. The disposable runner was corrected to explicitly select a local identity, tested offline with Google mode present, then frozen in this new directory. No production or normal development authentication setting was changed.

## Results

| Action | Route | Model | Requests / repairs | Elapsed | Outcome |
| --- | --- | --- | --- | --- | --- |
| Editable condition draft | `/theses/suggest` | Groq `openai/gpt-oss-20b` | 1 / 0 | 1.063s | PASS |
| Mixed evidence explanation | `/theses/{id}/ai-review` | Bitget `qwen3.8-max` | 1 / 0 | 36.419s | PASS |
| Cited conversation follow-up | `/theses/{id}/conversation` | Groq `qwen/qwen3.8-27b` | 1 / 0 | 0.747s | PASS |

**Total: 3 of 6 authorized provider requests**, 4,532 provider-reported tokens. Dollar cost was not measured. Times are one observation per role, not a latency guarantee. No extra extraction or retry was performed.

The draft preserved the explicit 75% margin and 80% revenue-growth floors, used supported metrics and returned editable canonical conditions. Its rationale was valid but unnecessarily long and process-oriented; this smoke-test contract pass is not a claim that its wording is polished.

The deterministic historical result remained margin INVALIDATED (74.6% versus 75%) and growth SUPPORTED (94% versus 80%). Qwen returned matching CONTRADICTS/SUPPORTS items, both citing `nvda-fy25-Third`, and explicitly identified the historical report and unknown future/current status. AI did not recompute or replace the saved finding.

The follow-up explained why only margin failed, cited the same allowed filing, retained uncertainty, and suggested checking the next quarterly report rather than making a buy/sell decision. Facts, source IDs and answer remained saved.

Repeating the review and identical conversation request returned the saved output with **zero additional provider calls**. Reopening the disposable SQLite database with unavailable providers restored the same saved conversation and assessment. The normal application database was not used for these cases.

## Limits and release status

This is a three-case, constructed historical integration check, not a current-source evaluation, independent holdout, prompt-injection benchmark, general accuracy score or browser/provider reliability study. Existing offline adversarial/citation tests remain separate evidence. The user-owned small study is untouched.

148 Python tests and 76 frontend tests pass, plus Ruff, source-code formatting, TypeScript and the production build. Existing dependency warnings and generated OpenAPI formatting warning remain disclosed in the close-out report. Desloppify's complete scores/dimensions are [recorded separately](../2026-10-04-research-closeout.md#desloppify-results); they are unchanged and are not hackathon grades.

Local SQLite has an integrity-checked online backup. The production backup is **not complete**: SSH timed out and the AWS profile has an expired login session referring to root. Restore non-root deployment access before any production migration/rebuild. No server data, accounts or runtime secrets were changed.
