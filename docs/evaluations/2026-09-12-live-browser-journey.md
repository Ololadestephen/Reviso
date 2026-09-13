# Clean install, deployment rehearsal and live browser journey — 2026-09-12

## Outcome

The current source tree passed a clean-install rehearsal, a production-shaped local container rehearsal and one complete desktop browser journey. Nothing was published, pushed or sent to a brokerage. The saved record remained a human-confirmed research thesis; Qwen proposed structure and reviewed supplied evidence but did not confirm, revise or retain it.

| Check | Result |
| --- | --- |
| Clean locked install | `uv sync --frozen` and `npm ci` succeeded in a fresh temporary copy; `npm ls --depth=0` was clean and npm reported zero vulnerabilities |
| Automated verification | 75 Python tests and 28 frontend tests passed; Ruff check/format, TypeScript, Prettier and Vite production build passed |
| Container build | Local image `reviso-local:verification`, image ID `sha256:6d40059eb5bf42046ad54ff46c50bf744f3cd198267c54b65ffad4fff29ceb65` |
| Container posture | Non-root `reviso` user, read-only root filesystem, `no-new-privileges`, loopback-only `127.0.0.1:8080`, runtime `.env`, SQLite test data on ephemeral `/app/data` |
| Browser journey | Passed after correcting two test-only locator/timing assertions; no application fix was required |
| Browser diagnostics | Zero console errors and zero uncaught page errors |
| Publication | None |

The Vite build emitted two non-fatal comments-about-`PURE` warnings from the installed Zod package. The Python suite emitted two upstream TestClient deprecation warnings. Neither failed a check.

## Live journey

The browser started with an empty thesis library, opened a new NVIDIA/rNVDA thesis and completed this path:

1. Qwen structured the editable draft through `bitget-qwen` / `qwen3.8-max` with prompt `thesis-extraction-v2`. The proposal preserved the 75% GAAP-margin and 80% year-over-year-revenue-growth floors. No record was saved until the human-flow save action.
2. The draft was saved and its assumptions were explicitly confirmed as version 2.
3. A live refresh retrieved the official NVIDIA newsroom release **NVIDIA Announces Financial Results for Second Quarter Fiscal 2027**, published August 26, 2026 for the quarter ended July 26, 2026. The parser recorded 75.0% GAAP gross margin and 106% reported year-over-year revenue growth. Retrieval availability was `AVAILABLE`; the source record displayed public origin, publication/reporting dates, excerpt SHA-256 and document SHA-256.
4. The same refresh observed public Bitget `RNVDAUSDT` data: last price 218.45 USDT, bid 218.52 and ask 218.94, source timestamp 08:19:25.560 UTC and retrieval timestamp 08:19:27.059 UTC. This is a dated observation, not a current quote, share-price comparison or recommendation.
5. Qwen reviewed only the selected NVIDIA evidence through prompt `evidence-review-v2`. It returned `SUPPORTS` for both confirmed assumptions and cited only evidence `nvda-public-acc61d7488198c00a3767dc764e5c3e6703ca2ebacdae3f57db04608472e285c`. Deterministic state remained `SUPPORTED` independently of the narrative review.
6. The human flow proposed a revision, changed the margin floor from 75% to 74%, supplied an explanation and saved version 3 with version 2 as parent. It then recorded an explicit retain decision as version 4.
7. A fresh browser resumed version 4. The decision timeline showed the public evidence, revision and retain event. Reloading the timeline URL directly succeeded, exercising the production SPA fallback. Returning to the library showed exactly one saved, Supported thesis linked to the correct record.

The browser screenshots are [library state](2026-09-12-live-browser-journey.png) and [immutable timeline](2026-09-12-live-browser-journey-timeline.png).

## Credit accounting

The server access log contains exactly one successful `POST /api/theses/extract` and one successful `POST /api/theses/{id}/ai-review`. The browser automation did not retry either action. Each Reviso AI action permits at most one internal schema-repair request, but the ordinary API log does not expose whether a repair occurred. The defensible total is therefore **two user-level AI actions and between two and four provider requests**. All later browser passes were read-only and made no Qwen call.

## Interpretation and limits

This is one developer-operated task-completion path, not an untouched AI benchmark, accessibility audit, load test or proof of investment quality. It verifies current integration among the browser, API, SQLite lifecycle, bounded Qwen adapters, NVIDIA public connector and Bitget public market bridge. The deployment configuration remains a local preparation: public-demo mode uses HTTPS-origin/host allowlists and HTTP Basic authentication, but Reviso still lacks multi-user accounts, per-user authorization, administrative audit controls, rate limiting and encrypted backups. A host, persistent storage and final public origin still require user approval and selection.
