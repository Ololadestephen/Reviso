# Groq diagnostic/error-handling release — 7 October 2026

The user approved commit, push and AWS deployment after the
[two-request diagnostic](2026-10-07-groq-diagnostic.md). Signed code commit
`64945e441412efabd8a8755a19b3f8edd03e048c` was pushed to GitHub main and deployed
to the existing Lightsail host. GitHub reports `verified: true`, reason `valid`.

The release includes the already-live landing-footer and public-scroll fixes,
their regression tests, the prepared demo document and the safe HTTP failure
boundary. Providers, prompts, citation checks and numerical findings are unchanged.
This release **does not establish a root cause or fix an observed upstream Groq
failure**: both diagnostic chat requests passed, and the original error lacked
its HTTP status. Future failures now expose safe, actionable categories/status.

## Verification before publication

274 backend tests, 126 frontend tests, Ruff, Python and frontend formatting,
TypeScript, production build and diff checks passed. Staged private-file and
configured-secret checks passed; no environment file, SQLite backup or key was
committed. SSH signing verified locally and on GitHub. No new code was added
during publication; the previous separate code-health checks remain applicable.
Existing dependency deprecation, Zod annotation and bundle-size warnings remain.

## Backup and cutover

An initial online production backup passed integrity checking. After building
the exact Git archive while the old app remained available, the application
was briefly stopped and a final backup taken before starting the new container:

`/app/data/backups/reviso-before-groq-errors-20261007T224027Z.sqlite3`

Integrity `ok`; permissions 0600; 323,584 bytes; SHA-256:
`63104cea4164e4d93f87ba297b1ab5342e3498e750fd6cf8ce36eb23de5515b6`.
The earlier online backup at `20261007T223859Z` has the same digest.
The final backup is also retained privately under the host's recovery directory
and in ignored local `data/backups/`. Neither copy is published.

Every row in **all 12 non-internal SQLite tables** matched the final backup
after cutover. Live integrity checking passed. Preserved counts:

| Table | Rows |
| --- | --- |
| users | 3 |
| identities | 2 |
| sessions | 2 |
| theses | 11 |
| assessments | 10 |
| assessment_selection | 5 |
| events | 5 |
| research_answers | 12 |
| research_threads | 6 |
| schema_migrations | 6 |
| llm_usage_days | 5 |
| llm_inflight | 0 |

No accounts, research, sessions or allowance rows were added/rewritten for this
verification. Runtime secrets retained the same file fingerprint and 0600
permissions. Bitget-first explanations, Groq chat/drafting and Google sign-in
remain selected; Gemini remains inactive. Caddy and persistent volumes were
not recreated or removed. No firewall change or billed snapshot was made.

## Live checks

- HTTPS home, Guide, Example, Privacy, Terms, App and health: HTTP 200.
- Unauthenticated theses and LLM-status APIs: HTTP 401.
- Runtime hashes for `api.py`, `llm.py` and `provider_errors.py` match the release.
- Expected frontend bundle `index-BCIjczmq.js` is served over HTTPS.
- A synthetic HTTP 429 response, constructed entirely in memory inside the
  runtime, passed the new error-handler check: API 503/detail and rounded-up
  `Retry-After: 2`. This was **not** a Groq request or a real failure reproduction.
- Health reports Google authentication and the retained Bitget Qwen primary.

No inference request was made during deployment or verification. The earlier
two-request approval is exhausted. Fresh signed-in chat/reopen verification
remains for the user; it is not claimed as performed in this release.

## Recovery

Previous reviewed runtime image: `reviso-reviso:before-groq-64945e4`.
Private source/config recovery directory:
`/home/ubuntu/reviso-release-backups/groq-64945e4/`.
The previous source archive and private runtime environment copy retain 0600
permissions. Rollback should preserve the current database and all named volumes;
do not restore an older database merely to undo an application-only release.
