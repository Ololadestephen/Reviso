# AWS submission release — 7 October 2026

Approved release code: signed Git commit `89bb036fec6c8133840215129d69469404c14694`,
pushed to `Ololadestephen/Reviso` main and deployed to `reviso-prod` on Lightsail.
The current Bitget-first explanation provider is retained. Gemini remains inactive.

## Before deployment

- The [final chat regression](final-chat-2026-10-07/REPORT.md) passed with one
  Groq request of its two-request ceiling, no repair, saved citations and persistence.
- 241 backend and 121 frontend tests, lint, formatting, TypeScript and build passed.
- Desloppify scan/status/next were run separately before and after the release
  tooling milestone. No new findings; subjective reviews remain pending.
- The remote main matched the local base before committing. The release commit's
  SSH signature verified locally. Staged files were checked against configured
  credentials; real environment files and SQLite databases were excluded.
- Non-root IAM profile `reviso-deployer-key` was used. SSH remains restricted to
  administrator `/32` addresses; only the current address was added.

## Backup and preserved data

An online SQLite backup at `/app/data/backups/reviso-before-submission-20261007T093904Z.sqlite3`
passed `pragma integrity_check`. Size: 290,816 bytes. SHA-256:
`4dd37125395af811947f628333b9b406f39029e01085a0efdcecbb40d868bbab`.
It is also kept privately on the host and in ignored local `data/backups/`.
Source and environment rollback copies are private under
`/home/ubuntu/reviso-release-backups/`. No billed Lightsail snapshot was enabled.

After deployment, every row in users, identities, theses, assessments, assessment
selection, events, research answers and research threads matched the backup.
The database passed integrity checking and kept migrations 1–6. Three users,
two identities, nine theses, eight assessments, four events, eleven research
answers and four research threads were preserved. No production record was added
or rewritten for verification.

Host `deploy/aws/.env` kept all original bytes/settings; only the real local SEC
contact setting was appended. Permissions remain 0600. Google and AI credentials
were not replaced. AWS Compose now passes that contact and explicitly selects
the existing primary explanation route. The application image was rebuilt from
the signed source archive and only the application container recreated. Caddy
and the existing `reviso_reviso-data` volume were retained.

## Live verification

- `https://revisoagent.xyz/`, `/guide`, `/example`, `/privacy`, `/app` and
  `/api/health`: HTTP 200.
- Unauthenticated `/api/theses` and `/api/llm/status`: HTTP 401.
- Health: Google authentication, private demo, configured Bitget Qwen 3.8 Max,
  `evidence-review-v5` and `research-question-v5`.
- Browser `/app`: the Google sign-in button rendered. It was not clicked.
- Runtime source hashes for the citation validator, language-model adapter and
  chat service match the reviewed local release.
- Direct read-only runtime public retrieval: NVIDIA financial release AVAILABLE;
  SEC company passages, Federal Reserve statement and BLS CPI/jobs AVAILABLE
  (five supplemental passages). No AI call or notebook mutation during deployment.

## Remaining checks and warnings

The user will sign in and reopen existing research after deployment. That
signed-in browser journey is **pending**, not claimed as passed. The user-owned
study, X post, recording and submission form are not performed by this release.

Build warnings remain for bundle size, Zod annotations and dependency
deprecations. The fresh npm audit also flagged a high-severity `source-map-js`
denial-of-service issue in the development/build graph. It is absent from the
running image; the production dependency installation reported zero known
vulnerabilities. Updating that build-only dependency is a follow-up, not silently
claimed fixed. Scanner security coverage is reduced without Bandit, and
unassessed subjective scores are not evidence of research accuracy.
