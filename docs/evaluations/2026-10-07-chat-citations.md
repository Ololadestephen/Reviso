# Chat citation fix — 7 October 2026

## Scope and result

The user requested the remaining chat citation fix before choosing the production
explanation provider. This work is local and offline. No AI provider request,
account authorization, secret change, original notebook mutation, commit, push,
AWS deployment, X post or submission was performed. Existing working-tree changes
were preserved.

The recorded October 4 company follow-up cited management commentary while its
summary repeated financial percentages from a different source. It now fails the
new provider boundary. Tests adapt its original text/citations to the new request
shape without editing any frozen artifact or changing its original PARTIAL result.

## Implementation

- `research-question-v5` asks for individually cited summary/fact/uncertainty
  statements. The schema and validation live in `backend/answer_validation.py`.
- Every summary and fact identifies its supplied source when evidence exists.
  A source-free response is allowed only with no reported facts when no evidence
  exists. A research-gap uncertainty can have no citation.
- Percentage values are compared with Decimal against the cited, actually supplied
  720-character excerpts and reported metrics, not an uncited or hidden full report.
  `%`, `percent`, `per cent`, signed values and grouped digits are handled.
  Malformed digit grouping fails rather than turning an invented value into a known
  observation. Confirmed thresholds must be labelled as minimum/threshold/floor.
- The entire summary + facts + uncertainty is limited to 70 whitespace-delimited
  words, or 160 when the user requests detail. At most three facts are allowed.
- The one allowed repair retains the source packet, question, saved finding,
  assumptions, attribution rules and length rules, and receives the validation error.
- Public answer/storage/export contracts stay unchanged. Citation links are the
  deduplicated union of sources actually named by the accepted statements; no
  irrelevant IDs are appended automatically. Saved old answers are not rewritten.
- The repeated-question shortcut checks owner-scoped saved provenance before
  reusing output. A changed prompt, provider or model no longer reuses the old
  last turn simply because the question text matches. Original chat history remains.
- Future frozen final/official live manifests also hash the new validator module.

## Verification

| Check | Result |
| --- | --- |
| Full backend suite | 238 passed; two existing framework deprecation warnings |
| New attribution suite | 22 cases included in the full backend suite |
| Full frontend suite | 121 passed across seven files |
| Ruff lint, backend/tests/scripts | PASS |
| Ruff formatting | PASS |
| Frontend/bridge Prettier | PASS |
| TypeScript | PASS |
| Production build | PASS |
| Git whitespace check | PASS |

Regressions cover the real frozen defect; inability to borrow a facts citation for
the summary; correct financial attribution plus labelled user thresholds; phantom
and absent IDs; invented percentages in uncertainty; truncated source boundaries;
reply limits; grouped-digit handling; source-free abstention; one repair and terminal
failure; old-prompt cache rejection; owner/thesis scoping; mock-provider API storage,
cache reuse, restart, exports, exact provider-request allowance counting, and no
persistence after rejection. Legacy mock provider responses were updated to the
new provider schema; frozen live evidence/results were not changed.

The build retains its existing >500 kB chunk warning and Zod annotation warnings.
Frontend tests retain the Node localStorage warning. These are not hidden passes
or research-validity claims.

## Limits and release gates

This rejects the observed summary attribution defect and numerical citation gaps.
It does not prove that every qualitative paraphrase, percentage meaning or other
numeric claim is semantically faithful. Finding comparisons still belong to the
existing numerical engine; no extra financial arithmetic was added. Source
selection usefulness and independent validation remain separate concerns.

The new chat prompt/schema has not been checked with a live provider. A fresh,
frozen and separately approved small public-source check is recommended before
a release-quality claim. Do not rerun the completed October 4 batch.

The optional Gemini review adapter and its earlier successful constructed check
are unchanged. Free-tier Gemini must not be silently activated for confidential
research or unrestricted public users. Google's terms prohibit sending sensitive,
confidential or personal information to unpaid services and require Paid Services
for API clients offered to users in the EEA, Switzerland or UK:
[official terms](https://ai.google.dev/gemini-api/terms).

## Desloppify

The repository-required skill kept the change in a dedicated attribution boundary,
with explicit failure handling, unchanged public contracts and offline regressions.
Separate backend and web scans, `status` and `next` ran before/after. Only existing
dependency/build exclusions were used; `.desloppify/` stays ignored. An intermediate
new nested-quantifier regex finding was fixed with a simpler digit matcher and
explicit grouped-digit validation, then scan-resolved without suppression.

`next` still requests the unassessed subjective review. No unrelated health campaign
or fabricated subjective review was performed. Two pre-existing backend security
findings remain. The scanner reports reduced Python security coverage because
Bandit is not on its execution PATH; these scores are not security certification
or research accuracy. No new backend/web finding remains relative to this turn's
pre-implementation scans.

| Project | Overall before → after | Objective | Strict | Verified | Open |
| --- | --- | --- | --- | --- | --- |
| Backend | 23.1 → 23.1 | 92.4 → 92.6 | 22.1 → 22.1 | 92.4 → 92.6 | 81 → 81 |
| Web | 21.9 → 21.9 | 87.5 → 87.5 | 20.0 → 20.0 | 87.5 → 87.5 | 76 → 76 |

| Mechanical dimension | Backend health before → after | Backend strict | Web health before → after | Web strict |
| --- | --- | --- | --- | --- |
| Code quality | 89.2 → 89.5 | 85.4 → 85.6 | 96.2 → 96.2 | 94.7 → 94.7 |
| Security | 99.0 → 99.1 | 95.5 → 95.6 | 100 → 100 | 100 → 100 |
| File health | 86.5 → 86.9 | 84.2 → 84.7 | 98.8 → 98.8 | 97.5 → 97.5 |
| Duplication | 100 → 100 | 100 → 100 | 100 → 100 | 100 → 100 |
| Test health | 87.8 → 88.0 | 78.4 → 78.9 | 57.6 → 57.6 | 31.7 → 31.7 |

All subjective zeros below are unassessed placeholders, not grades.

| Subjective dimension | Backend health/strict before → after | Web health/strict before → after |
| --- | --- | --- |
| Abstraction fitness | 0/0 → 0/0 | 0/0 → 0/0 |
| AI-generated debt | 0/0 → 0/0 | 0/0 → 0/0 |
| API surface coherence | 0/0 → 0/0 | 0/0 → 0/0 |
| Authorization consistency | 0/0 → 0/0 | 0/0 → 0/0 |
| Contract coherence | 0/0 → 0/0 | 0/0 → 0/0 |
| Convention outlier | 0/0 → 0/0 | 0/0 → 0/0 |
| Cross-module architecture | 0/0 → 0/0 | 0/0 → 0/0 |
| Dependency health | 0/0 → 0/0 | 0/0 → 0/0 |
| Design coherence | 0/0 → 0/0 | 0/0 → 0/0 |
| Error consistency | 0/0 → 0/0 | 0/0 → 0/0 |
| High-level elegance | 0/0 → 0/0 | 0/0 → 0/0 |
| Incomplete migration | 0/0 → 0/0 | 0/0 → 0/0 |
| Initialization coupling | 0/0 → 0/0 | 0/0 → 0/0 |
| Logic clarity | 0/0 → 0/0 | 0/0 → 0/0 |
| Low-level elegance | 0/0 → 0/0 | 0/0 → 0/0 |
| Mid-level elegance | 0/0 → 0/0 | 0/0 → 0/0 |
| Naming quality | 0/0 → 0/0 | 0/0 → 0/0 |
| Package organization | 0/0 → 0/0 | 0/0 → 0/0 |
| Test strategy | 0/0 → 0/0 | 0/0 → 0/0 |
| Type safety | 0/0 → 0/0 | 0/0 → 0/0 |
