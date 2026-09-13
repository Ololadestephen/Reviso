# Reviso newcomer experience and stock expansion

Status: implemented and verified locally on September 12, 2026. Production deployment and the new live-Qwen validation batch remain separately gated. The interaction specification is in `docs/design/newcomer-flow.md`, and the explicit instrument/source boundary is in `docs/STOCK_COVERAGE.md`.

## Outcome

A first-time visitor can choose a supported stock, describe an idea, review understandable assumptions, inspect cited evidence, and record a personal decision without coaching. The result can be downloaded and revisited. Preserve the existing research-only model and immutable history.

Success means a usable journey, not simply a redesigned dashboard or a larger ticker dropdown. Target three fully supported companies in total: NVIDIA plus two verified additions. Do not claim support until both the instrument and company evidence work.

## Read first and preserve

- Read `AGENTS.md`, `PLAN.md`, `docs/DECISIONS.md`, `docs/EVALUATION.md`, and this document. Inspect current user edits before implementation; the working tree contains substantial uncommitted work.
- Keep FastAPI, SQLite, React/Vite, the existing public Bitget SDK bridge, and the server-side Qwen adapter. No framework or hosting migration is needed.
- Human confirmation alone confirms or revises a thesis. AI cannot record decisions, execute trades, override deterministic invalidation, or invent financial inputs.
- Financial arithmetic remains Decimal-based. Company identity, metric definitions, units, periods, and observation times must match before comparison.
- Distinguish company shares from tokenized exposure, and observed evidence from historical replay and hypothetical scenarios.
- Keep existing NVIDIA thesis IDs, versions, citations, decisions, and deep links readable. Use additive, repeatable migrations where required; never rewrite old evidence to match new parsing logic.
- Preserve the private-demo access gate. Public guest access, individual accounts, user isolation, and global spend/rate controls are a separate release scope. This plan does not make the shared database suitable for unrestricted public use.
- No production changes, commits, pushes, new paid services, or live Qwen calls without the relevant authorization. Prior testing approvals are not an unlimited allowance for new features.

## Product decisions

### First visit and returning users

The library should explain the benefit in one sentence, offer “Start research” as the primary action, and offer “Explore an example” separately. A new user's draft starts empty. Example values and evidence must be clearly labeled and must not overwrite a user's draft.

Returning users see readable company names, a short idea title or summary, current evidence status, last assessment time, and their next action. Keep the timeline accessible without making it the starting point.

### Five-step journey

| Step | Main screen content | Primary action | Completion requirement |
| --- | --- | --- | --- |
| 1. Choose a stock | Company cards/search, verified token name, research coverage, brief representation explanation | Research this stock | Supported instrument selected |
| 2. Explain your idea | Plain-language idea, example prompts, holding period; a short position/risk section | Suggest assumptions | Enough context for a proposal; AI may ask for missing information |
| 3. Review assumptions | Editable assumption cards explaining the claim, metric, threshold, and what would challenge it | Confirm my assumptions | User reviews rules and required inputs; no silently supplied example values |
| 4. Inspect evidence | Plain-language result, assumption-by-assumption findings, dates, citations, missing information, follow-up questions | Record my decision | Saved assessment or explicit unavailable-evidence state; no requirement to obtain a favorable result |
| 5. Record a decision | Keep, revise, or retire the research idea; reason and relevant evidence | Save decision | Explicit user action recorded against the correct version |

Step navigation must permit going back without losing input. Show why an action is unavailable and what resolves it. Do not force users to run historical replay or numerical stress before they can understand company evidence.

Risk handling for this slice: retain the currently required position amount, proposed entry, maximum acceptable loss, and holding period before final confirmation. Explain these in familiar language in step 2/3. Proposed entry is user input, not an automatically inferred live quote. Offer a visibly dated market observation only as an explicit user choice. Keep slippage and detailed scenario settings under Advanced, with any applied defaults disclosed in the confirmation summary. An entirely optional position/risk model is a separate contract change and is not assumed here.

AI suggestions are editable proposals. Unspecified thresholds must be presented as missing inputs or clearly labeled suggestions requiring review; they are not facts or recommendations established by the model. Users must be able to add/remove supported assumption cards and complete the journey manually if AI is unavailable. Qualitative claims must not be forced into meaningless percentage fields.

### Screen and language direction

- Use a visible step indicator and one primary action per stage. Keep advanced settings, raw provenance, detailed stress parameters, and replay controls in secondary sections.
- Prefer “Your idea,” “What needs to stay true,” “Evidence needs attention,” and “Why did this change?” over internal contract terminology.
- Explain GAAP margin, year-over-year growth, thresholds, and slippage beside the relevant input. Avoid a mandatory glossary detour.
- Show a short evidence summary first, with source details one click away. Status cannot rely on color alone.
- Replace misleading deployed labels such as “LOCAL RESEARCH.” Move provider configuration instructions and prompt-version details out of the main user flow while retaining appropriate provenance access.
- Provide deliberate empty, loading, success, error, unavailable, stale, and partial-evidence states. AI latency needs truthful progress wording, preserved inputs, and a recovery path; do not show invented progress percentages or auto-retry paid calls.
- Verify keyboard operation, labels, visible focus, error association, and layouts at approximately 390px, 768px, and desktop widths. Drawers/dialogs must manage and restore focus.

## Delivery phases

### Phase 0 — Design checkpoint

Deliver a local screen specification or static prototype for the library and all five stages, including mobile layouts and the main failure states. Show the example path separately from a blank new idea. Include a short click-through narrative showing where the user understands the result and what to do next.

Review the design with the user before wiring the redesign into the application. This is a deliberate checkpoint requested by this handoff, not a claim that infrastructure work is blocked. During review, the implementer may continue read-only instrument/source feasibility checks.

Exit: an approved interaction design and a source/instrument feasibility shortlist. Do not substitute production functionality for a static prototype or represent sample evidence as live.

### Phase 1 — Verify stock coverage and generalize contracts

First verify candidate companies through official Bitget instrument/product sources and official issuer disclosures. Record exact provider symbol, underlying identity, token representation, quote currency, observed availability, verification time, supported metrics, and source URLs in a coverage document. Do not guess symbols from company tickers or assume gross margin is consistently disclosed by every company.

Select two additions with reliable public quarterly evidence and a verified Bitget instrument. If fewer qualify, report the evidence and implement only verified coverage; do not silently count unsupported stock cards toward the target.

Implement a small explicit instrument registry and company-to-provider mapping:

- A catalog endpoint returns display information and research capabilities; server validation accepts only registry IDs. Preserve the existing singular endpoint if needed for compatibility.
- Generalize instrument-specific contracts, market normalization, SDK bridge arguments, prompts, response validation, and frontend schemas. Keep shell/subprocess arguments bounded to validated IDs and fixed operations.
- Bind evidence to an explicit issuer identity and assessments to the selected instrument. Multiple tokens could reference one issuer later, but this slice need not offer them.
- Include identity in cache keys, hashes, retrieval state, and saved AI context. A new company's quote or evidence must never be reused for another company.
- Expose supported metrics per company. Do not treat GAAP, non-GAAP, guidance, and reported historical metrics as interchangeable.
- Restrict historical NVIDIA replay to NVIDIA. Unsupported replay is explained or hidden for other companies, never relabeled as their history.
- Changing a company's selection clears incompatible unsaved proposals after a clear warning. Once a thesis is saved, researching a different company creates a new thesis rather than changing the identity of its old history.
- Replace the complete-thesis-only extraction input with a bounded proposal input that can represent incomplete newcomer information. Keep final confirmation strict. Handle legacy saved defaults without silently introducing those defaults into new drafts.

Likely touchpoints: `backend/instruments.py`, `contracts.py`, `routes.py`, `providers.py`, `market.py`, `llm.py`, `replay.py`, `services.py`, `storage.py`, `bridge/market.mjs`, and the frontend API schemas/endpoints. Split cohesive new modules where useful rather than growing large route or prompt files.

Exit: existing NVIDIA behavior and stored records remain valid; every enabled company passes identity, market, and evidence fixtures; unsupported IDs and cross-company evidence are rejected.

### Phase 2 — Build the guided UI

Implement the approved screens using the generalized catalog. Refactor `Workspace.tsx`, `ThesisEditor.tsx`, and `useWorkspace.ts` into cohesive stage components/hooks, preserving the existing routing and query conventions. Update `Library.tsx`, `AppLayout.tsx`, and the shared styles consistently.

Separate editable onboarding state from a confirmed thesis. Save recoverable incomplete drafts through a dedicated draft contract/storage path if required; do not weaken the confirmed thesis contract or insert fake values to satisfy it. Define explicit Save draft behavior and verify refresh/reopen recovery. Avoid persisting private draft text in URLs or broad browser storage by accident.

Review cards must show what the user is actually confirming. Keep numeric condition text consistent with the canonical rule; represent qualitative claims explicitly as requiring research. Confirming, revising, and deciding remain separate actions.

Exit: all five steps work on desktop and mobile; manual fallback works; errors retain user input; back/reload does not lose saved progress; existing deep links continue to work.

### Phase 3 — Make evidence recovery useful

Build recovery into the existing bounded provider interface, with issuer-specific parsing where necessary:

- Attempt an alternative verified official path for the same issuer and report/period where feasible. Record its provenance and the attempted primary source.
- A mirror of the same release is retrieval redundancy, not independent corroboration. Deduplicate shared releases and avoid counting them twice.
- If the newest report is known but inaccessible, an older report cannot silently become a successful current refresh.
- Preserve the last successful saved assessment. Show it with its original date and a visible warning when a current refresh fails. This is a reference to older saved state, not newly refreshed evidence.
- Distinguish complete retrieval failure, partial metric extraction, stale evidence, and conflicting observations. Conflicts produce uncertainty rather than choosing the more favorable number.
- Give users a concrete next action: retry within limits, inspect the official source, inspect the last saved assessment, or continue recording a decision that acknowledges missing evidence.
- Keep timeouts, size limits, redirect restrictions, source allowlists, and cache isolation. User-supplied arbitrary URL fetching and document uploads are outside this slice.

For each enabled issuer, document whether a secondary official path exists and what fallback actually works. Where no viable alternative exists, report that limitation; do not claim source resilience solely because a retry button exists.

Exit: tests simulate primary failure, viable secondary retrieval, both sources failing, stale saved state, partial data, conflicts, and wrong-issuer responses. UI copy matches each outcome.

### Phase 4 — Add cited follow-up questions

Add a bounded “Ask about this research” panel within the evidence step. Suggested questions include “Why did this assumption change?”, “Which evidence supports this?”, and “What is still missing?” Users can also enter a short custom question.

- Ground each answer in the selected saved thesis version, assessment, and allowlisted evidence IDs. Fetch authoritative context server-side; do not trust a client-supplied evidence bundle.
- Use a typed answer with source references and an explicit insufficient-evidence result. Validate citations and retain source links users can open.
- Separate quoted/reported facts, explanation, uncertainty, and any hypothetical scenario. Route arithmetic through existing tested engines if needed; otherwise decline unsupported calculations rather than letting Qwen invent them.
- Do not fetch arbitrary sites, change rules, confirm a thesis, or record a decision through this panel.
- Bind saved question/answer history to its original version and assessment. After new evidence or a revision, show old answers as belonging to earlier context; do not present them as current.
- Use bounded question/context/output lengths, server-side idempotency for duplicate submissions, and explicit loading/failure states. Cache keys include question, context, provider/model, and prompt version. No automatic paid retries.
- Render text and citations safely; reject invented evidence IDs and links. Treat source text and user text as untrusted model inputs, not operational instructions.

Exit: mocked tests cover supported answers, insufficient evidence, prompt injection, false citations, wrong-company context, outdated answers, duplicate clicks, and provider failure. A later authorized live batch verifies actual model behavior.

### Phase 5 — Export a research snapshot

Provide “Download research” for a saved thesis. Initial formats: readable Markdown and structured JSON. PDF rendering, public share links, and hosted exports are outside this slice.

Include company/token identity, thesis version, confirmation status, assumptions, assessment state, source excerpts/links/dates, evidence availability, numerical inputs/results with scenario labels, cited follow-up answers for the selected context, and decision history through the selected version. Include export time and a schema version in JSON.

Export from a consistent saved snapshot, not editable unsaved fields. Include the state actually shown to the user; never refetch evidence or call Qwen as part of export. Older-version export must not include future decisions or answers. Draft exports, if offered, must say unconfirmed and make no assessment claim.

Keep access checks on the download endpoint; use safe filenames and attachment headers. Export only explicit research fields, excluding configuration, credentials, server paths, request headers, and unrelated theses.

Exit: downloaded files agree with the saved UI state, preserve Decimal strings and provenance, remain readable without the app, and work when providers are unavailable.

## Verification and approval gates

Before non-trivial implementation, follow the installed Desloppify skill and repository instructions: inspect ignores, scan backend and `apps/web` separately, and review status/next. Rescan at coherent milestones and address regressions introduced by this work. Do not run repository-wide cleanup or fabricate subjective review results. This planning-only change does not require a code scan.

Use existing test tooling and commands from the README/package scripts. Required checks include Python tests and Ruff, frontend behavior tests, formatting, TypeScript, OpenAPI snapshot updates through `scripts/dump_openapi.py`, and production build. Use synthetic fixtures for source failures and model responses. Preserve historical evaluation artifacts; create new evaluation outputs separately.

Minimum acceptance matrix:

| Area | Required evidence |
| --- | --- |
| Compatibility | Existing NVIDIA database copy opens; old versions, citations, decisions, and deep links survive migrations/restart |
| Stock identity | All enabled companies work independently; unknown IDs and cross-company market/evidence inputs fail |
| Newcomer flow | Blank start and labeled example; manual and mocked-AI paths; correction/back/reload; clear primary actions |
| Research boundaries | Missing/conflicting/stale evidence remains visible; no old report promoted to current; numerical and narrative roles remain separate |
| Follow-ups | Valid saved-context citations, abstention, injection resistance, duplicates, and stale-context handling |
| Export | Saved-state fidelity, decimal preservation, correct version boundary, no secret or unrelated-record fields |
| Accessibility/layout | Keyboard-only journey, focus recovery, labeled controls, understandable errors, mobile/tablet/desktop walkthrough |

After offline checks, prepare one frozen live validation proposal with named cases, expected outcomes, and a hard provider-request cap. Cover extraction for the enabled companies, cited follow-up answers, insufficient evidence, injection resistance, and saved-context integration. State which public-source checks do not require Qwen. Ask for the new credit allowance before running; do not reuse previous authorization or run extra calls while waiting.

Proposed user-test target, not a measured result: three people unfamiliar with Reviso attempt the five-step journey and export. Record completion, time, assistance, confusion, and whether they can distinguish evidence from scenarios and a research decision from a trade. Aim for all three to finish without coaching; report misses honestly. Do not invent participants or results. User coordination is needed to recruit participants; no outreach is authorized by this plan.

Before deployment, summarize changes, tests, remaining limitations, migration/backup procedure, and rollback compatibility. Test migrations against a disposable database copy. Request deployment approval only after the local release is reviewable. The deployed shared demo and paid snapshot decision remain unchanged until separately authorized.

## Scope boundaries and delivery order

Order: design checkpoint → verified stock/contracts foundation → guided UI → evidence recovery → cited follow-ups → export → integrated offline/browser checks → authorized live validation → deployment review.

Do not add trading execution, arbitrary stock coverage, autonomous recommendations, a general web-browsing agent, premium/discount pricing, accounts, or a new hosting stack as part of this assignment. Do not drop requested follow-ups or export merely because a redesigned homepage works. If a required issuer/source cannot be verified, report the precise blocker and preserve the remaining work.

At each phase, hand off changed files, checks performed, screenshots where relevant, known limitations, and the next phase. Do not describe code-quality scores as product readiness or investment accuracy.

## Delegation prompt

> Implement the Reviso newcomer experience plan in `docs/NEWCOMER-EXPERIENCE-PLAN.md`. Read `AGENTS.md`, `PLAN.md`, and `docs/DECISIONS.md` first and preserve current user changes. Start with Phase 0: produce a local screen design covering the five-step journey, mobile layouts, and recovery states for my review. You may also perform read-only official-source verification for two additional stocks. After I approve the design, implement the phases in the documented order, retaining the existing research safeguards and NVIDIA records. Do not call paid APIs, alter production, commit, push, remove demo authentication, or contact third parties without the relevant authorization. Use the repository's required quality workflow during implementation. Report actual acceptance evidence and unresolved gaps, not projected judge scores.
