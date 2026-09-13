# Local quality report — 2026-09-13

The installed Desloppify workflow was used for separate coherent backend and frontend scans, with `status` and `next` after each milestone. Exclusions cover dependency/build/cache output; no application files were excluded to raise scores. No suppressions, fabricated subjective evidence or wontfix decisions were entered. No branch, commit, push or external issue was created.

## Latest tool-reported scores

These are scanner outputs, not test coverage percentages or research-accuracy scores. All subjective dimensions are still unassessed; the tool records them as zero. Independent review/triage is incomplete: the latest scans still queue an initial subjective review, which was deferred without fabricated scores because runner-backed review remains gated. Mechanical scans and tests continue.

| Project | Overall (lenient) | Objective | Strict | Verified | Open findings |
| --- | ---: | ---: | ---: | ---: | ---: |
| backend | 22.8 | 91.3 | 21.0 | 91.3 | 56 |
| apps/web | 20.5 | 82.2 | 19.4 | 82.2 | 57 |

| Mechanical dimension | Backend health | Backend strict | Web health | Web strict |
| --- | ---: | ---: | ---: | ---: |
| File health | 92.6 | 88.9 | 100.0 | 98.1 |
| Code quality | 89.3 | 84.9 | 97.7 | 95.6 |
| Duplication | 100.0 | 100.0 | 99.0 | 99.0 |
| Security | 98.4 | 95.3 | 100.0 | 100.0 |
| Test health | 85.2 | 69.8 | 48.0 | 36.5 |

| Subjective dimension | Backend | Web | Assessment status |
| --- | ---: | ---: | --- |
| Abstraction fit | 0 | 0 | Unassessed |
| AI-generated debt | 0 | 0 | Unassessed |
| API coherence | 0 | 0 | Unassessed |
| Authorization consistency | 0 | 0 | Unassessed |
| Contract coherence | 0 | 0 | Unassessed |
| Convention outlier | 0 | 0 | Unassessed |
| Cross-module architecture | 0 | 0 | Unassessed |
| Dependency health | 0 | 0 | Unassessed |
| Design coherence | 0 | 0 | Unassessed |
| Error consistency | 0 | 0 | Unassessed |
| High-level elegance | 0 | 0 | Unassessed |
| Incomplete migration | 0 | 0 | Unassessed |
| Initialization coupling | 0 | 0 | Unassessed |
| Logic clarity | 0 | 0 | Unassessed |
| Low-level elegance | 0 | 0 | Unassessed |
| Mid-level elegance | 0 | 0 | Unassessed |
| Naming quality | 0 | 0 | Unassessed |
| Package organization | 0 | 0 | Unassessed |
| Test strategy | 0 | 0 | Unassessed |
| Type safety | 0 | 0 | Unassessed |

Scores are transcribed rather than recalculated. The scanner reports strict/lenient gaps even though its wontfix count is zero; this report does not infer a cause or silently replace those values. Its test-health numbers use import/detector heuristics, not measured runtime coverage. The backend scan also reported zero LOC despite scanning 15 production modules, while the web scan reported 2,883 LOC across 26 files. These tool-reporting limitations should be investigated independently before interpreting numerical score changes as engineering progress.

## Earlier milestone in this continuation

| Project | Overall | Objective | Strict | Verified |
| --- | ---: | ---: | ---: | ---: |
| backend before additional provider/storage tests | 20.6 | 82.4 | 18.3 | 82.4 |
| web before component tests | 12.9 | 51.4 | 12.7 | 51.4 |

Earlier backend mechanical health/strict: file 100/93.6, code 87/84.3, duplication 100/100, security 97.3/93.2, test 63.9/44.2. Earlier web: file 100/93.6, code 93.6/93.6, duplication 100/100, security 100/100, test 0.4/0.4. All twenty subjective dimensions were also zero/unassessed then. A small decrease in web code score accompanies explicit mode/rewind branches; they are behaviorally tested, not suppressed.

## Relevant remaining findings

- Backend B404/B603 flag importing/invoking subprocess. Inspection confirms a resolved Node executable, fixed SDK bridge path, no shell, no user-controlled command, timeout and minimal environment. Regression tests exercise these boundaries. Findings remain open for independent review; this is not a security certification.
- Provider normalization and stored/API dictionaries need continued typed-contract review. Runtime schemas and OpenAPI snapshot checks now cover the browser/API boundary, but scanner output is not proof of full contract coherence.
- Backend route coverage is reported as transitive: API integration tests reach the router through `create_app`. No meaningless direct import was added to influence that score.
- The Bitget Qwen and Groq adapters have contract, repair, failure, provider-selection, idempotence and API-boundary tests using injected fakes or an HTTP mock transport. The new suggestion and cited-question paths include false-citation repair, untrusted-input framing, duplicate submission and outdated-context tests. The frozen newcomer batch used six live requests and is reported separately; its suggestion errors were not suppressed or converted into passes.
- NVIDIA, Apple and Microsoft evidence fixtures cover issuer identity, aligned quarterly facts, partial/stale states, recovery labeling and cross-company rejection. Live-evaluation harnesses have offline freeze/cap tests and are excluded from automatic live execution by filename. Captured Qwen bare-array and incomplete-response shapes have regression tests. The earlier frozen v2 validation passed all five application contracts; the newer newcomer batch produced two adjudicated passes and three errors under its own frozen corpus. Neither is a general research-accuracy measure. No exception was suppressed. Overall verification now totals 104 backend and 45 frontend tests.
- Frontend tests exercise runtime response schemas and the newcomer controls, including blank inputs, the collapsed slippage default, an actually blank manual claim, verified stock choice, manual fallback, locked conditions, unavailable evidence, current-context citations and source opening. The public-page test also verifies that the landing page and prepared example render without an API request. The final local Apple browser journey completed the five-stage flow and deep-link reload; keyboard focus, native dialog restoration and 390px/768px overflow checks passed. The later landing-page browser check covered the public home, example, research library and company picker in the production build. A subsequent visual pass added the local Reviso mark, favicon, company marks, gradient hero and evidence chart; it passed the same frontend suite and a production-browser check. Safari/Firefox, formal accessibility certification and broad interaction/race coverage remain incomplete. The scanner's web test-health result reflects its import/detector model and is not the same quantity as the 34 passing runtime tests.
- Structural extractions separated API routing, frontend state, timeline, replay, ledger and scenario components. Remaining source-URL and style-size findings are not a reason to remove provenance or hide application files.

## Reproduce mechanical checks

From the repository root, with Desloppify installed:

```sh
PATH="$PWD/.venv/bin:$PWD/node_modules/.bin:$PATH" desloppify --lang python scan --path backend --no-badge
desloppify status
desloppify next
```

From `apps/web`, with the repository's `.venv/bin` and `node_modules/.bin` on PATH:

```sh
desloppify --lang typescript scan --path . --no-badge
desloppify status
desloppify next
```

Review retry artifacts are retained under `.desloppify/subagents/runs/20260910_122219`. Resume review with an available approved runner; do not claim the scan→review→triage cycle is complete. No automatic remediation or scanner instruction authorizes publishing or committing.
