# Reviso

### Have a stock idea? See if the evidence supports it.

Reviso helps you turn a stock idea into clear conditions, check them against company reports, and save your decision with the evidence behind it.

[Open Reviso](https://revisoagent.xyz) · [User guide](https://revisoagent.xyz/guide) · [Worked example](https://revisoagent.xyz/example) · [Demo script](docs/DEMO_SCRIPT.md)

Built for Bitget AI Base Camp Season 2, in the AI Trading Desk / Decision Stress Testing track.

## Why Reviso?

It is easy to have a reason to buy a stock and forget what would make you reconsider. Research ends up spread across notes, articles, and chat messages.

Reviso keeps the idea, its conditions, the sources, and your decisions in one record. When a report changes the picture, you can see which condition still holds and which one needs attention.

## What you get

- A private library of ideas, versions, evidence checks, conversations and decisions
- Six checked companies, each bound to one Bitget Reality instrument and one official evidence path
- A rules-based finding from reported numbers, not from a model vote
- AI as an explainer beside the result, not as the decision
- Exports of a saved version as Markdown, JSON or PDF

Public pages (`/`, `/guide`, `/example`, `/privacy`, `/terms`) are read-only. They do not read your notebook and do not call Qwen. Saved research lives behind Google sign-in at `/app`.

## How a session works

1. **Pick a company.** Choose NVIDIA, Apple, Microsoft, Alphabet, Amazon or Tesla. Each card shows the Bitget tokenized pair Reviso has verified for that issuer.
2. **Write the idea.** Explain why you are interested and what would make you reconsider. Write the conditions yourself or ask AI for an editable draft. Review and confirm them to save a version that stays in your history.
3. **Check the evidence.** Reviso fetches the allowlisted filing and a separately dated Bitget USDT observation, then compares only compatible reported metrics. Missing numbers stay missing. Qwen can explain the saved excerpts. It cannot change 74.6 versus 75.
4. **Decide.** Keep, change or set aside the idea, in your own words. Later edits create a new version. The earlier conditions, finding and decision remain attached to the version they belonged to.

New research is a short path: Choose → Explain → Review. After confirmation the saved record is a workspace: Idea → Conditions → Evidence → Decision.

A complete written NVIDIA case, with no live fetch and no Qwen call, is at [`/example`](https://revisoagent.xyz/example). The product walkthrough is at [`/guide`](https://revisoagent.xyz/guide).

## A concrete example

For a historical NVIDIA example, suppose your idea depends on gross margin staying at least **75%** and revenue growing at least **80%** compared with a year earlier.

| Historical report | Gross margin | Revenue growth | Result against your conditions |
| --- | --- | --- | --- |
| Fiscal 2025 Q2 | 75.1% | 122% | Both conditions hold |
| Fiscal 2025 Q3 | 74.6% | 94% | Margin falls below the limit; growth still holds |

Reviso preserves the original conditions and shows what changed. You decide whether to keep, change, or set aside the idea. This is a prepared historical example, not a current recommendation or a token-price backtest.

## How AI helps

Different tasks use separate model routes:

| Task | Provider and model |
| --- | --- |
| Idea extraction | Bitget Qwen 3.8 Max; Groq Qwen when the Bitget key is unset |
| Evidence explanation | Same primary route by default; opt-in Gemini `gemini-3.5-flash-lite` |
| Editable condition suggestions | Groq `openai/gpt-oss-20b` |
| Filing follow-up questions | Groq `qwen/qwen3.8-27b` |

These models cannot confirm conditions, fetch an arbitrary website, compute the financial result, record keep / change / set aside, or place a trade. Repair attempts count toward the shared AI daily allowance. If AI is offline or the allowance is used, you can still finish the path by hand. Saved findings stay readable.

Gemini explanations are an optional local integration, not yet live-validated.
The server accepts `GEMINI_API_KEY` or the existing `Gemini_API` name (the standard
name takes priority). A key alone does not activate it. After reviewing Google's
[data-use terms](https://ai.google.dev/gemini-api/terms), set
`REVISO_REVIEW_PROVIDER=gemini` and restart the backend with `--env-file .env`.
Google's free-tier content may be used to improve its products; confirm the right
tier and privacy policy before enabling this for other people. Google OAuth's
client ID is unrelated to this API key.

Gemini uses a fixed Google endpoint, structured JSON, minimal reasoning and a
10-second network timeout per request. One validation repair is allowed and
counts toward the existing allowance; network/rate-limit errors are not retried
and never fall back to Bitget. This is a latency safeguard, not a measured reply
time. Set `REVISO_REVIEW_PROVIDER=primary` to restore the previous route.
`/llm/status` reports separate `review_provider`, `review_model` and
`review_configured` fields; configured means a key is present, not authenticated
or live-tested. Old saved explanations retain their original provenance.

## Evidence rules

Reviso only fetches allowlisted hosts and paths. External text is data, never instructions. Financial arithmetic uses Decimal. Absent observations stay absent.

| Kind of data | Role |
| --- | --- |
| Official company filing | The source for company conditions |
| Selected SEC report passages | Company-prepared management discussion and risks; commentary, not engine metrics or independent proof |
| Federal Reserve policy statement | Dated economy-wide interest-rate context, not company evidence |
| BLS inflation and jobs releases | Dated economy-wide context; current pages may be revised, so availability starts at retrieval |
| Bitget Reality USDT observation | Dated market context for the selected instrument, not a finding |
| xStocks indicative USD price | Separate comparison context for the same company. Never filing evidence, never a substitute for the Bitget quote |
| Historical NVIDIA replay | Labeled history for the prepared example. Not current evidence for a live check |
| Controlled numerical stresses | Explicit scenarios, not forecasts |

**Supported** means the available filing supports that specific condition. **Invalidated** requires a confirmed floor and a reported number that misses it. One missed floor does not rewrite the other comparisons. An older report is not promoted as a successful current check. Guidance and non-GAAP figures cannot fill a missing GAAP fact.

Reviso is a research tool and cannot place trades. Tokenized Bitget products are not registered company shares in your name. Reviso does not establish redemption rights or exact tracking of the listed share price.

On a live result, **More research → Load official research** retrieves those three
official source groups. It saves a new check with your existing financial filing,
rechecks its age and preserves the previous check. It does not refresh the
financial filing or price and makes no AI call. Request a new explanation or use
chat separately when ready; both can cite loaded passages. Historical replays and
controlled scenarios do not fetch today's releases. Source failures stay visible.

For SEC report retrieval, set `REVISO_SEC_USER_AGENT` on the server to an identifying
application name and a genuine contact email, as required by SEC fair-access
guidance. A personal contact is sufficient; do not invent an address. No API key
is required for these sources. BLS access may return HTTP 403 from some networks;
Reviso reports unavailable rather than bypassing access controls. See
[official research sources](docs/OFFICIAL_RESEARCH.md) for boundaries and setup.

xStocks research is a small, manually checked reading list on the result page,
with company/wider-market labels and newer relevant links first. Articles newer
than the saved check date are hidden. It is not an automatic feed: articles are
not ingested into findings or chat. Content ingestion requires permission; see
[the integration boundary](docs/XSTOCKS_RESEARCH.md).

## Coverage

An issuer is enabled only when both a Bitget market identity and an official evidence path are in code.

| Company | Bitget instrument | Current company evidence | What numerical conditions can use |
| --- | --- | --- | --- |
| NVIDIA | rNVDA / USDT (`RNVDAUSDT`) | Newsroom earnings release; matching SEC company facts only if that path fails | Reported GAAP gross margin and year-over-year revenue growth, plus manual research |
| Apple | rAAPL / USDT (`RAAPLUSDT`) | SEC company facts | Reported GAAP gross margin and year-over-year revenue growth, plus manual research |
| Microsoft | rMSFT / USDT (`RMSFTUSDT`) | SEC company facts | Reported GAAP gross margin and year-over-year revenue growth, plus manual research |
| Alphabet | rGOOGL / USDT (`RGOOGLUSDT`) | SEC company facts | Year-over-year revenue growth, plus manual research |
| Amazon | rAMZN / USDT (`RAMZNUSDT`) | SEC company facts | Year-over-year revenue growth, plus manual research |
| Tesla | rTSLA / USDT (`RTSLAUSDT`) | SEC company facts | Reported GAAP gross margin and year-over-year revenue growth, plus manual research |

Exact identities, metric limits and source URLs are in [stock coverage](docs/STOCK_COVERAGE.md). The evidence contract is in [data and evidence policy](docs/DATA_AND_EVIDENCE_POLICY.md).

## Accounts and privacy

Each signed-in person has a separate library. Identity is Google’s stable `sub`. Email is display data and does not merge accounts. Ideas, versions, evidence checks, chats and decisions are stored under an internal Reviso user id. Another signed-in person cannot open that record.

The illustrated face on the account control is generated in the browser from DiceBear Fun Emoji artwork (CC BY 4.0). The account id is used only as a local seed.

Public demo mode requires Google sign-in, HTTPS origin/host allowlists, CSRF on mutations, and Qwen usage limits. Shared HTTP Basic is not an access path. Loopback development uses an explicit local identity and must never be a production fallback.

## Stack

```text
Browser (React, Vite, TypeScript)
        │
        ▼
FastAPI  ── SQLite (immutable versions, owner-scoped rows)
        ├── Bitget public market (official SDK, read-only)
        ├── NVIDIA newsroom / SEC company facts
        ├── xStocks public USD context
        └── Primary extraction; optional Gemini review; Groq chat and drafts
```

Contracts, providers, numerical engines, services and the SQLite repository stay separate. The browser never receives provider keys. Production serves the built web app and `/api` from one origin behind Caddy on AWS Lightsail. SQLite and TLS certificates live on named Docker volumes. One application replica is required while SQLite is the store.

## Run locally

Prerequisites: Python 3.12 through [uv](https://docs.astral.sh/uv/), and Node.js 22.13 or newer. From this repository root:

```sh
git clone https://github.com/Ololadestephen/Reviso.git
cd Reviso
uv sync --frozen
npm ci
cp .env.example .env
```

Start the API:

```sh
uv run uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload --env-file .env
```

Start the frontend:

```sh
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). Loopback uses an explicit local identity. API docs are at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) in local mode only; they are disabled in public demo.

Manual conditions and the historical example work without model keys. Live company reports and market data require internet access; AI features require the corresponding server-side keys.

The public Bitget SDK bridge needs outbound access to `api.bitget.com`. Failures produce unavailable observations, not invented values. Private thesis text is not sent to Bitget.

A production-shaped container that binds only to loopback is documented in [deployment](docs/DEPLOYMENT.md):

```sh
docker compose build
docker compose up
```

Then open [http://127.0.0.1:8080](http://127.0.0.1:8080). Do not publish that listener.

## Configuration

Copy `.env.example` to a Git-ignored `.env`. Do not put secrets in `VITE_*` variables, chat, or the image.

| Variable | Purpose |
| --- | --- |
| `BITGET_QWEN_API_KEY` | Sponsored Qwen 3.8 Max. Loaded from `.env` or the process environment. An exported process value wins. The endpoint and model id are fixed in backend code. |
| `GEMINI_API_KEY` / `Gemini_API` | Server-only Gemini explanation key. Standard name wins; never prefix with `VITE_`. |
| `REVISO_REVIEW_PROVIDER` | `primary` (default) or `gemini`. Only changes result explanations, not extraction, drafting or chat. Gemini has no automatic provider fallback. |
| `GROQ_API_KEY` | Filing follow-up chat (Groq Qwen 3.8 27B) and condition drafts (gpt-oss-20b). Also the extraction/review fallback if Bitget is unset. `REVISO_LLM_MODEL` changes the Groq chat id; `REVISO_DRAFT_MODEL` changes the Groq draft id. |
| `REVISO_DB_PATH` | SQLite file. Default `data/reviso-v1.sqlite3`. Migrations run on startup. |
| `REVISO_AUTH_MODE` | `local` (default on loopback), `google`, or `simulated`. Public demo cannot use local or simulated. |
| `REVISO_GOOGLE_CLIENT_ID` | Public Google web client id. Required for Google sign-in and for public demo. |
| `REVISO_PUBLIC_DEMO` | `1` only behind HTTPS with explicit hosts, origins, Google sign-in and Qwen limits. |
| `REVISO_QWEN_USER_DAILY_LIMIT` / `REVISO_QWEN_TOTAL_DAILY_LIMIT` | Public-demo allowances. Repair attempts count. |

For local Google sign-in, Google Cloud must list both `http://127.0.0.1:5173` and `http://localhost:5173` as Authorized JavaScript origins. Production uses `https://revisoagent.xyz`.

## Verify

Project structure:

```text
apps/web/       React frontend and UI tests
backend/        API, providers, research logic, authentication, storage
bridge/         Read-only Bitget SDK bridge
tests/          Backend tests
deploy/aws/     Lightsail and Caddy configuration
docs/           Architecture, evidence policy, evaluation, and demo materials
```

Run these checks from the repository root:

```sh
uv run ruff check backend tests
uv run ruff format --check backend tests
uv run pytest -q
npm test
npm run format:check
npm run typecheck
npm run build
```

Tests establish behavior. They do not establish research accuracy. Mechanical quality scans are recorded in [quality](docs/QUALITY.md). Live Qwen batches and browser journeys are recorded in [evaluation](docs/EVALUATION.md). No general accuracy score is claimed from those runs.

A [24-slot independent research pilot](docs/evaluations/independent-pilot-01/README.md)
is prepared, not completed. Source selection and expected answers await an
independent reviewer. No holdout or paid request budget is authorised yet.

## Limits

- Six companies, not an open equity universe
- Suggestion-path timeouts and some contract rejections remain disclosed product risk
- Qwen streaming is untested
- Safari / Firefox and a newcomer user study have not been done
- There is no administrative audit UI and no encrypted database backup beyond host snapshots
- Automatic Lightsail snapshots are off until billed storage is approved

## Further reading

- [Demo script and recording checklist](docs/DEMO_SCRIPT.md)
- [Guide to using Reviso](https://revisoagent.xyz/guide)
- [NVIDIA example](https://revisoagent.xyz/example)
- [Architecture](docs/ARCHITECTURE.md)
- [Decisions](docs/DECISIONS.md)
- [Stock coverage](docs/STOCK_COVERAGE.md)
- [Data and evidence policy](docs/DATA_AND_EVIDENCE_POLICY.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Plan](PLAN.md)
- [Submission](docs/SUBMISSION.md)
