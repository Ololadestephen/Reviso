<div align="center">
  <img src="backend/assets/reviso-mark.svg" width="64" height="64" alt="Reviso logo" />
  <h1>Reviso</h1>
  <p><strong>Have a stock idea? See if the evidence supports it.</strong></p>
  <p>Turn your idea into clear conditions, check the company report, and keep the evidence behind your decision.</p>
  <p>
    <a href="https://revisoagent.xyz">Try Reviso</a> ·
    <a href="https://youtu.be/tj8HOTQ-atc">Watch the demo</a> ·
    <a href="https://revisoagent.xyz/guide">Read the guide</a> ·
    <a href="https://revisoagent.xyz/example">See an example</a>
  </p>
</div>

---

Reviso is a private stock-research notebook. It keeps your idea, conditions, sources, conversations, and decisions together—so you can see what still holds when new evidence arrives.

Built for **Bitget AI Base Camp Season 2**, in the **AI Trading Desk / Decision Stress Testing** track.

## From idea to decision

1. **Choose a company.** Start with NVIDIA, Apple, Microsoft, Google (Alphabet), Amazon, or Tesla.
2. **Explain your idea.** Write what you expect and what would make you reconsider. AI can suggest conditions; you edit and confirm them.
3. **Check the report.** Compare reported numbers with your conditions. Read the sources, get an explanation, and ask follow-up questions.
4. **Record your decision.** Keep, change, or set aside the idea, with a reason in your own words.

Every confirmed edit creates a new version. Earlier conditions, evidence checks, and decisions stay in your history.

## What makes it useful

- **A clear comparison:** reported values beside your confirmed limits.
- **Traceable evidence:** dated company sources and links you can inspect.
- **AI where it helps:** editable drafts, explanations, and cited follow-up answers.
- **Your own library:** Google sign-in keeps each person's research separate.
- **A record you can take away:** export a saved version as Markdown, JSON, or PDF.

The landing page, guide, and example are public. Your notebook at `/app` requires Google sign-in on the live site.

## Evidence first, AI second

The numerical result comes from rules-based comparisons using Decimal arithmetic—not a model's opinion. Missing numbers stay missing. Qualitative conditions need your review.

AI explains the saved evidence; it cannot change the comparison, confirm conditions for you, or record your decision. If a provider is unavailable, manual research and saved findings remain accessible.

| Task                                    | Default model route                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| Turn an idea into structured conditions | Bitget Qwen 3.8 Max; Groq Qwen if the Bitget key is absent |
| Explain a saved finding                 | The primary route above; optional Gemini adapter           |
| Suggest editable conditions             | Groq `openai/gpt-oss-20b`                                  |
| Answer filing follow-up questions       | Groq `qwen/qwen3.8-27b`                                    |

AI features send the supplied idea or selected research context to the configured provider. Keys stay on the server. Requests and validation repairs count toward usage limits.

## Sources and coverage

Reviso supports **six companies**, each mapped to a specific Bitget Reality instrument and an official company-evidence route. NVIDIA uses its newsroom earnings release, with a matching SEC fallback; the other five use SEC company facts. Available metrics vary by issuer.

Additional reading includes selected SEC report passages, Federal Reserve statements, and BLS inflation and jobs releases. These provide context, not automatic proof of a company condition.

Bitget quotes and xStocks indicative prices are separate market context. xStocks articles are curated reading links, not inputs to findings or chat. Historical examples and what-if scenarios are clearly labeled.

Reviso does not execute trades. Tokenized products are not registered shares in your name, and a supported condition is not a buy recommendation or a promise about future results.

See [stock coverage](docs/STOCK_COVERAGE.md), [evidence policy](docs/DATA_AND_EVIDENCE_POLICY.md), and [official research sources](docs/OFFICIAL_RESEARCH.md) for the exact boundaries.

## Run locally

You need **Python 3.12**, [uv](https://docs.astral.sh/uv/), and **Node.js 22.13 or newer**.

```sh
git clone https://github.com/Ololadestephen/Reviso.git
cd Reviso
uv sync --frozen
npm ci
cp .env.example .env
```

Start the backend:

```sh
uv run uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload --env-file .env
```

In a second terminal, start the frontend:

```sh
npm run dev
```

Open [localhost:5173](http://127.0.0.1:5173). Loopback development uses a local identity; Google setup is not required. Local API documentation is at [localhost:8000/docs](http://127.0.0.1:8000/docs).

Manual conditions and the prepared historical example need no AI key. Live sources require internet access. To load SEC reports, set `REVISO_SEC_USER_AGENT` in `.env` to an application name and a genuine contact email. AI features need their corresponding server-side keys.

See [configuration](docs/CONFIGURATION.md) for environment variables, Google sign-in, model selection, and the Docker preview. Never put provider keys in frontend variables or commit `.env`.

## Under the hood

React, TypeScript, and Vite power the frontend. FastAPI handles research, authentication, and provider calls; SQLite stores owner-scoped records and immutable versions. A read-only Node bridge uses the official Bitget SDK.

```text
apps/web/       Frontend and UI tests
backend/        API, providers, comparisons, authentication, storage
bridge/         Read-only Bitget market bridge
tests/          Backend tests
deploy/aws/     Lightsail and Caddy configuration
docs/           Setup, evidence policy, evaluations, demo materials
```

Production runs on AWS Lightsail behind Caddy, serving the frontend and API from one origin. SQLite and TLS certificates use persistent Docker volumes. The SQLite deployment uses one application replica.

## Verification

Run from the repository root:

```sh
uv run ruff check backend tests
uv run ruff format --check backend tests
uv run pytest -q
npm test
npm run format:check
npm run typecheck
npm run build
```

The [October 7 release report](docs/evaluations/2026-10-07-groq-release.md) records the checks and deployment safeguards. Tests verify behavior, not investment outcomes or general research accuracy.

Current limits: six companies, provider timeouts and contract failures, untested streaming, and incomplete cross-browser and newcomer testing. An [independent research pilot](docs/evaluations/independent-pilot-01/README.md) is prepared, not completed. No general accuracy score is claimed.

## Project notes

- [Configuration](docs/CONFIGURATION.md) · [Deployment and backups](docs/DEPLOYMENT.md)
- [Architecture](docs/ARCHITECTURE.md) · [Engineering decisions](docs/DECISIONS.md)
- [Evaluations](docs/EVALUATION.md) · [Code quality](docs/QUALITY.md)
- [xStocks reading boundary](docs/XSTOCKS_RESEARCH.md)
- [Demo script](docs/DEMO_SCRIPT.md) · [Submission notes](docs/SUBMISSION.md)
