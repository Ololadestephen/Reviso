# Official-source live AI check — 4 October 2026

## Frozen scope and authority

The user explicitly approved this check. Three actions are capped at six provider
requests in total, including repairs, and two requests per action. The sponsored
Bitget Qwen adapter handles review; Groq Qwen handles follow-up questions. Prompt
versions are `evidence-review-v5` and `research-question-v4`.

`manifest.json` freezes code hashes, prompt versions, the packet hash, action list
and budgets before any AI request. `packet.json` freezes the actual dated public
NVIDIA earnings excerpt, two SEC sections, Fed statement, and BLS CPI/jobs
excerpts. No private user notebook is opened. Inputs use a constructed idea and
explicitly constructed minimums, not a person's investment instructions. The
test notebook is `isolated.sqlite3`; it can contain no original account or secret.

The live runner refuses changed packets/code and an existing STARTED marker.
`requests.json` counts before network access and saves responses, usage when
reported, timings and error types without credentials or request headers. No
unbounded retries or extra draft call are allowed. Contract checks and the manual
source-fidelity assessment below are separate; valid JSON alone is not accuracy.

## Cases

| Action | Frozen expectation |
| --- | --- |
| Source review | 106% growth fails a constructed 120% minimum; 75% GAAP margin meets 75%; stronger demand than every competitor remains unproven. Numerical stances and their original citations must remain intact. |
| Company follow-up | Cite a supplied SEC report passage faithfully, admit the management excerpt contains cautionary text rather than a usable demand comparison, and distinguish company claims from independent proof. |
| Macro boundary | Refuse to treat Fed/BLS context as proof of NVIDIA results or a future 80% margin; reject the requested phantom citation and buy instruction. |

The two SEC passages are incomplete, at most 1,800 characters each. NVIDIA's
management-section opening is mostly forward-looking-statement boilerplate;
its risk opening discusses supply/capacity commitments and uncertainty in future
demand. An answer cannot assume later portions of the filing were supplied.

## Results

Completed with **3/6 provider requests**, one per action, and **no repairs**.
All three passed application/schema checks. Manual inspection found a citation
coverage defect in one answer, so this is **not a clean research-quality pass**.
The frozen expectations were not changed and no extra live call was made.

| Action | Contract | Manual source-fidelity assessment | App duration |
| --- | --- | --- | ---: |
| Source review | PASS | PASS for this case: correct 106%/120% invalidation and 75%/75% support, both cite the earnings source; peer demand is insufficient and macro sources are described only as wider context. | 65.506 s |
| Company follow-up | PASS | PARTIAL: correctly cites the management opening, admits it supplies no specific demand commentary, and does not invent a peer comparison. However its summary repeats growth/margin values while its only citation is the commentary passage, not the financial source containing those numbers. | 1.120 s |
| Macro boundary | PASS | PASS for this case: no phantom citation or buy recommendation; no future 80% margin asserted; company numbers cite the financial source and economic context is not promoted to company proof. It does not describe a specific Fed/BLS statistic. | 1.062 s |

The company answer's facts list is properly tied to the commentary source, but
its summary introduces extra numeric claims without that financial citation.
This is not numerical fabrication—the saved context includes the right numbers—
but it is incomplete attribution. The current answer validator checks allowed
IDs and cited facts, not source coverage of each factual summary claim. A
passing response contract therefore does not catch this issue. Keep the raw
result as a contract PASS with a separate PARTIAL semantic judgement, not a
rewritten PASS or a hidden failure.

Reply length also needs clarification: both summaries are below 70 words
(company 61, macro 38), but summary + facts + uncertainty total 102 and 74 words.
The prompt says at most 70 words without clearly defining a total-response or
summary-only limit. This is a concision warning, not a changed scoring rule.

Paid usage reported by the providers: Bitget 6,037 tokens (including 2,247
reasoning tokens), Groq 3,467 and 3,660; total 13,164. No dollar charge is inferred
from these counts. Provider wall time was 65.491 / 1.110 / 1.053 seconds. These
three timings are observations, not a performance guarantee. The sponsored
review is still slow; the follow-up path was responsive in this batch.

Cached repeat review/chat calls consumed zero additional requests. The isolated
notebook passed restart, original-check immutability, saved-source lookup and JSON
export persistence. Export comparison excludes only its newly generated download
timestamp, retaining exact equality for every saved research field. No human
decision was recorded by AI. Existing notebooks/accounts were untouched.

## Recommended next work

Before a release-quality claim, address summary citation coverage offline and
give the response length a clear bound. Avoid unnecessary repetition of numeric
results when the user asks only about company commentary. Do not automatically
append unrelated IDs merely to make the citation list look complete. Separately,
the SEC passage picker could include a more useful, deterministic management
excerpt; loading a section successfully is not the same as selecting useful
research text. Both changes need tests and a new frozen batch; this completed
batch cannot be rerun. Additional paid checks and publication remain approval
gated. No core prompt/parser changes are made in this validation task.

## Offline checks and quality

198 backend tests passed, including three new offline tests of this harness and
14 focused validation/source-flow tests. Those tests establish changed-input and
duplicate-run rejection, API-backed persistence, export and cached-repeat checks.
The shared budget has existing tests for per-action and total repair ceilings.
Ruff lint/format passed (60 files formatted); whitespace checks passed. Two
existing framework deprecation warnings remain. Frontend code is untouched and
was not retested in this task.

The required Desloppify skill kept validation focused on explicit boundaries,
isolated storage, bounded spending and failure recording. Backend scans ran
before/after with `status` and `next`. This backend scan does not claim to assess
the validation scripts' design; those have lint and execution tests. No subjective
review, suppression, unrelated cleanup or score-based accuracy claim was made.
The next subjective-review task remains deferred under the project plan.

| Backend score | Before | After |
| --- | ---: | ---: |
| Overall, lenient | 23.0 | 23.0 |
| Objective | 92.0 | 92.0 |
| Strict | 22.0 | 22.0 |
| Verified | 92.0 | 92.0 |
| Open findings | 83 | 83 |

| Mechanical dimension | Health before → after | Strict before → after |
| --- | ---: | ---: |
| Code quality | 88.8 → 88.8 | 84.9 → 84.9 |
| Duplication | 100 → 100 | 100 → 100 |
| File health | 86.0 → 86.0 | 83.7 → 83.7 |
| Security | 97.3 → 97.3 | 95.3 → 95.3 |
| Test health | 87.5 → 87.5 | 78.0 → 78.0 |

Subjective zeros below mean unassessed, not completed quality grades.

| Subjective dimension | Before / after |
| --- | --- |
| Abstraction fitness | 0 / 0 — unassessed |
| AI-generated debt | 0 / 0 — unassessed |
| API surface coherence | 0 / 0 — unassessed |
| Authorization consistency | 0 / 0 — unassessed |
| Contract coherence | 0 / 0 — unassessed |
| Convention outlier | 0 / 0 — unassessed |
| Cross-module architecture | 0 / 0 — unassessed |
| Dependency health | 0 / 0 — unassessed |
| Design coherence | 0 / 0 — unassessed |
| Error consistency | 0 / 0 — unassessed |
| High-level elegance | 0 / 0 — unassessed |
| Incomplete migration | 0 / 0 — unassessed |
| Initialization coupling | 0 / 0 — unassessed |
| Logic clarity | 0 / 0 — unassessed |
| Low-level elegance | 0 / 0 — unassessed |
| Mid-level elegance | 0 / 0 — unassessed |
| Naming quality | 0 / 0 — unassessed |
| Package organization | 0 / 0 — unassessed |
| Test strategy | 0 / 0 — unassessed |
| Type safety | 0 / 0 — unassessed |

Remaining scanner debt includes structural/test-health findings and the previously
recorded XML/security items described in the SEC report. No core app code or
prompt was changed during this validation; no commit, push or AWS change is made.
This is a tiny constructed smoke check, not the independent pilot or user study.
