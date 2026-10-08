# Reviso configuration

Keep configuration on the server. Copy `.env.example` to a Git-ignored `.env`; never put provider keys in `VITE_*` variables, chat, or a container image.

The local startup command in the [README](../README.md) loads `.env` through Uvicorn's `--env-file` option. An exported process variable takes precedence over its `.env` value. Restart the backend after changing configuration.

## Environment variables

| Variable                                                               | Purpose                                                                                                                       |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `REVISO_DB_PATH`                                                       | SQLite file; defaults to `data/reviso-v1.sqlite3`. Migrations run on startup. Back up an existing database before an upgrade. |
| `REVISO_SEC_USER_AGENT`                                                | Identifying application name and genuine contact email for SEC retrieval. No SEC API key is required.                         |
| `BITGET_QWEN_API_KEY`                                                  | Primary extraction and explanation provider: Bitget Qwen 3.8 Max. Endpoint and model are fixed in the backend.                |
| `GROQ_API_KEY`                                                         | Follow-up chat and condition drafts; also primary extraction/explanation when the Bitget key is absent.                       |
| `REVISO_LLM_MODEL`                                                     | Groq chat and primary-fallback model; defaults to `qwen/qwen3.8-27b`.                                                         |
| `REVISO_DRAFT_MODEL`                                                   | Groq condition-draft model; defaults to `openai/gpt-oss-20b`.                                                                 |
| `REVISO_REVIEW_PROVIDER`                                               | `primary` (default) or `gemini`. Changes result explanations only—not extraction, drafting, or chat.                          |
| `GEMINI_API_KEY` / `Gemini_API`                                        | Optional Gemini explanation key. The standard name takes priority. A key alone does not activate Gemini.                      |
| `REVISO_AUTH_MODE`                                                     | `local`, `google`, or `simulated`. Loopback defaults to local identity; public demo cannot use local or simulated mode.       |
| `REVISO_GOOGLE_CLIENT_ID`                                              | Google web client ID for sign-in. This is public configuration, not a model API key.                                          |
| `REVISO_PUBLIC_DEMO`                                                   | Set to `1` only with HTTPS, Google sign-in, explicit host/origin allowlists, and configured AI limits.                        |
| `REVISO_SERVE_WEB`                                                     | Enables serving the built frontend from the backend for a single-origin deployment.                                           |
| `REVISO_ALLOWED_HOSTS` / `REVISO_ALLOWED_ORIGINS`                      | Explicit deployment host and browser-origin allowlists. See the deployment guide for production configuration.                |
| `REVISO_QWEN_USER_DAILY_LIMIT` / `REVISO_QWEN_TOTAL_DAILY_LIMIT`       | Per-user and total daily AI request allowances. Validation repairs count.                                                     |
| `REVISO_QWEN_MAX_CONCURRENT_USER` / `REVISO_QWEN_MAX_CONCURRENT_TOTAL` | Per-user and total concurrent AI request limits.                                                                              |

Despite the `QWEN` prefix, these allowance controls also apply to the other AI routes. Saved research remains readable when an allowance runs out.

## Google sign-in

Local development works without Google using the explicit local identity. To test real sign-in, select `REVISO_AUTH_MODE=google` and configure a Google Cloud OAuth web client.

Add the origins you will actually use to its **Authorized JavaScript origins**:

- `http://127.0.0.1:5173`
- `http://localhost:5173`
- `https://revisoagent.xyz` for the live deployment

Set `REVISO_GOOGLE_CLIENT_ID` to that client's ID. The backend verifies Google's identity and creates an HttpOnly session. Google `sub`, not email, identifies a returning user; each library is scoped to an internal Reviso user ID.

Public demo requires Google and cannot fall back to a local identity. Shared HTTP Basic is not an access path. Mutations require CSRF protection; local API documentation is disabled in public demo mode.

## AI routes

With `REVISO_REVIEW_PROVIDER=primary`, extraction and explanations use Bitget Qwen when its key is present. If that key is absent, they use Groq when configured. This is configuration selection, not automatic failover after a failed request.

Drafts and follow-up chat use their separate Groq routes. The browser never receives provider keys. AI actions send the supplied idea or selected research context to the configured provider; review its data-use terms before enabling it for other people.

Models cannot confirm conditions, compute the numerical finding, fetch arbitrary websites, or record human decisions. Source and numerical validation still apply to model output. An allowed validation repair counts as another request; provider HTTP failures do not trigger automatic network retries or provider switches.

### Optional Gemini explanations

Set both:

```dotenv
REVISO_REVIEW_PROVIDER=gemini
GEMINI_API_KEY=your-server-side-key
```

The existing `Gemini_API` name is also accepted. Google OAuth's client ID is unrelated to this key.

The adapter uses the fixed Google OpenAI-compatible endpoint, `gemini-3.5-flash-lite`, structured JSON, minimal reasoning, and a 10-second network timeout per request. One validation repair is allowed; there is no automatic provider fallback. The timeout is a safeguard, not a reply-time guarantee.

One constructed public NVIDIA sample [passed a live local check](evaluations/gemini-ai-2026-10-04/REPORT.md). That is not a broad quality benchmark. Gemini is not the active AWS explanation provider in the October 7 release.

Review Google's [API data-use terms](https://ai.google.dev/gemini-api/terms), account tier, and regional requirements before activation for public users. Set `REVISO_REVIEW_PROVIDER=primary` to restore the primary route.

The authenticated `/llm/status` endpoint reports review provider, model, and configuration separately. “Configured” means a key is present—not that it has authenticated successfully. Existing saved explanations retain their original provider provenance.

## Source access

Live company reports and market observations require internet access. The Bitget SDK bridge needs outbound access to `api.bitget.com`; it is read-only and does not receive thesis text. This is separate from the Bitget Qwen AI route.

Use a real contact in `REVISO_SEC_USER_AGENT`; a personal contact is sufficient. Source failures remain unavailable rather than producing invented values or bypassing access controls.

**More research → Load official research** adds selected SEC passages, Federal Reserve, and BLS context to a new check, retaining the financial filing and previous check. It rechecks filing age but does not refresh the filing or quote and makes no AI call. Historical examples and controlled scenarios do not fetch today's releases.

See [official research sources](OFFICIAL_RESEARCH.md) for the exact source boundaries and [xStocks research](XSTOCKS_RESEARCH.md) for the curated-link policy. xStocks articles do not enter findings or chat.

## Docker preview and production

For a production-shaped local preview:

```sh
docker compose build
docker compose up
```

Open [127.0.0.1:8080](http://127.0.0.1:8080). The preview binds to loopback; do not expose it as a public deployment.

Production uses AWS Lightsail, Caddy, a single application replica, and named volumes for SQLite and TLS certificates. Preserve accounts, secrets, and volumes during upgrades. Take an integrity-checked SQLite backup before migration or release.

The current setup has no administrative audit interface or application-level encrypted database backup; automated Lightsail snapshots remain disabled pending approval for billed storage. Follow [deployment and recovery](DEPLOYMENT.md) and [AWS setup](../deploy/aws/README.md) before publishing.
