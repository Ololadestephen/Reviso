# Reviso

Know what would change your mind.

Reviso turns a trade idea into explicit assumptions, finds the conditions that break it, and revises the assessment when new evidence arrives. Built for Bitget AI Base Camp Hackathon Season 2, AI Trading Desk / Decision Stress Testing.

Status: a working private-demo research product, not a release-ready investment adviser. The local release guides a newcomer through company choice, idea, editable assumptions, cited evidence and a human decision. NVIDIA, Apple and Microsoft are explicitly allowlisted; current official evidence, per-stock public Bitget observations, recovery states, cited follow-up questions and saved Markdown/JSON exports are implemented. A provider-neutral LLM boundary prefers sponsored Bitget Qwen 3.8 Max and retains Qwen 3.8 27B on Groq as fallback. The AWS-hosted private demo has passed authenticated HTTPS, live-provider and persistence checks but still runs the earlier NVIDIA build. No execution or brokerage synchronization.

## Run locally

Prerequisites: Python 3.12 through uv, and Node.js 22.13+ (verified here with Python 3.12 and Node 25). Run from this repository root:

```sh
uv sync --frozen
npm ci
cp .env.example .env
```

Start the API in one terminal:

```sh
uv run uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload --env-file .env
```

Start the frontend in another:

```sh
npm run dev
```

Open http://127.0.0.1:5173 . API documentation: http://127.0.0.1:8000/docs . No credentials are needed for replay or public market data. The public SDK bridge needs outbound access to api.bitget.com; failures produce unavailable observations, not invented values. No private thesis is sent to Bitget.

To enable the preferred sponsored route, place `BITGET_QWEN_API_KEY` in the ignored local `.env`, the API process environment or a local secret manager, then restart the API. The documented `--env-file .env` command loads that file before Reviso starts; an already-exported process variable takes precedence. The adapter uses the fixed organizer endpoint `https://hackathon.bitgetops.com/v1/responses` and model `qwen3.8-max`. Do not paste the key into chat, commit it, or use a `VITE_*` variable. `GROQ_API_KEY` remains an optional fallback; its default model is `qwen/qwen3.8-27b`, and `REVISO_LLM_MODEL` can change only that fallback model ID. Both endpoints are fixed in backend code and cannot be redirected by a request or environment variable.

SQLite initializes its migrations automatically at `data/reviso-v1.sqlite3`. To use another local file, set `REVISO_DB_PATH` in `.env` or export it before starting the API. `.env.example` contains placeholders only; copy values into the Git-ignored `.env`. Do not place secrets in Vite variables. A provider-neutral container, loopback-only preview and AWS Lightsail private-demo stack are documented in [deployment](docs/DEPLOYMENT.md). Runtime credentials remain server-side and ignored by Git.

## Walk through the research slice

1. Start with a blank idea or open the separately labeled NVIDIA example. Choose NVIDIA, Apple or Microsoft; each card identifies the Bitget tokenized exposure and research capability.
2. Explain the idea and enter your own position/risk assumptions. Proposed entry is not inferred from a quote. Slippage stays under Advanced.
3. Continue manually or ask Qwen for editable assumption suggestions. Review every claim, metric and change-of-mind rule, save the draft, then explicitly confirm the immutable version.
4. Refresh current evidence. Reviso retrieves the allowlisted issuer source and a separately dated public Bitget observation, then evaluates only compatible reported metrics. Open the source, inspect missing information, optionally request a bounded Qwen narrative review, or ask a cited follow-up question tied to that saved assessment.
5. Keep, revise or retire the thesis and explain why. Download the exact saved version as Markdown or JSON. The timeline retains earlier assumptions, assessments, sources and decisions.

The NVIDIA example also offers its two-step historical company-disclosure replay: GAAP margin 75.1% supports a 75% floor at the first cutoff; 74.6% invalidates it at the second while revenue growth remains separately supported. Apple and Microsoft do not relabel that NVIDIA history as their own.

Company retrieval needs no API key. NVIDIA uses a fixed newsroom search plus one approved earnings-release path, with its matching SEC company-facts feed as explicitly labeled retrieval redundancy only when the primary path is unavailable. Apple and Microsoft use exact CIK-bound SEC company-facts URLs. Redirect, content-type, size, issuer, period and timestamp checks fail closed; caches are isolated by instrument. An older filing is not promoted as a successful current refresh. Only compatible reported metrics are derived; guidance and non-GAAP values cannot fill missing GAAP facts. See [stock coverage](docs/STOCK_COVERAGE.md).

For the negative control, start a new thesis and make only the revenue-growth assumption essential before confirmation. The margin decline alone then does not invalidate the thesis. This is developer-inspected calibration, not a blind evaluation.

New research starts a separate record; it does not delete old data or change the company identity of an existing thesis. The library lists saved records with readable company names, latest states and next actions.

## Verify

```sh
uv run ruff check backend tests
uv run ruff format --check backend tests
uv run pytest -q
npm test
npm run format:check
npm run build
```

Latest local newcomer release: 95 Python tests and 34 frontend tests pass with static/format checks, TypeScript and the Vite production build. A fresh locked install passed with zero npm vulnerabilities. A disposable production-built browser path completed the five-stage Apple journey with public SEC/Bitget data, keyboard validation/focus checks, 390px and 768px layout checks, deep-link persistence and no Qwen request. A later local UI pass added a public indigo-to-violet landing page, local vector brand/company marks, a richer read-only NVIDIA walkthrough, plain-language guide and protected `/app` boundary; these public pages make no API request. The frozen newcomer Qwen batch used 6/10 authorized requests: both cited-question cases passed after offline correction of one harness false negative, while the three suggestion cases exposed two provider timeouts and one post-repair local-contract rejection. The deployed private demo still runs the earlier NVIDIA build. See [evaluation](docs/EVALUATION.md), the [live-Qwen report](docs/evaluations/2026-09-12-newcomer-live-validation-proposal/REPORT.md), the [final browser report](docs/evaluations/2026-09-12-newcomer-final-browser.md), the earlier [deployed-flow report](docs/evaluations/2026-09-12-live-browser-journey.md) and the [quality report](docs/QUALITY.md).

## Safety and release gates

Bind the normal local mode to loopback only. The opt-in public-demo mode adds explicit HTTPS origin/host allowlists and HTTP Basic authentication, but it is still single-user and has no per-user isolation. Do not expose the local Compose listener publicly. The five-case real-model validation is a post-fix developer-constructed set, not an untouched independent benchmark. It makes no investment-performance, general research-accuracy or production-safety claim.

Before this local release replaces production: decide how to handle the live suggestion timeouts/contract rejection, complete a Safari/Firefox matrix and newcomer user study, and explicitly approve deployment. Independent quality review also remains incomplete. The migration/backup rehearsal, local keyboard/viewport checks, final domain and earlier deployed journey are verified. Groq remains a replaceable fallback rather than the sponsored production route. Nothing has been committed or pushed.

See [plan](PLAN.md), [architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md), [evidence policy](docs/DATA_AND_EVIDENCE_POLICY.md) and [submission requirements](docs/SUBMISSION.md).
