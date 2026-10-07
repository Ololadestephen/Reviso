# Landing-page release — 7 October 2026

The user approved moving the latest landing-page update to the live domain
before recording. Only `apps/web/src/MarketingLayout.tsx` was copied onto the
existing reviewed AWS source. No Git commit or push was performed. The deployment
is the previous release plus this uncommitted component change, not a new signed
Git release. Script and plan edits remain local documentation.

The home-page footer disclaimer is hidden on `/` only; it remains in the Guide
and other public article pages. Source SHA-256:
`6d6db50d0129b9511d61a626fcd3b3b8636b07d1fb0ade764aee1b6f6ec38076`.
The live HTML loads `index-sAEHIZ5a.js`.

## Backup and preservation

Online SQLite backup:
`/app/data/backups/reviso-before-landing-20261007T180544Z.sqlite3`.
Integrity: `ok`; permissions: 0600. SHA-256:
`55573e9af24bb41f288e1b714dec5c571a3f321b17f08d6be44505283d01ea6f`.

Every row in users, identities, theses, assessments, assessment selection,
events, answers, threads and migration history matched the backup after deployment.
Three users, two identities, nine thesis rows, eight assessments, four events,
twelve answers and five threads remain. Live database integrity passed.

Host environment fingerprint is unchanged, with permissions 0600. Only the app
container was rebuilt/recreated; SQLite and Caddy volumes and the Caddy container
were retained. Prior source is recoverable under
`/home/ubuntu/reviso-release-backups/landing-20261007T180544Z/`; prior image tag:
`reviso-reviso:before-landing-20261007T180544Z`.

The deployment used the existing non-root IAM identity. SSH access was added only
for the observed current administrator IP `98.97.77.224/32`, retaining existing
rules. No paid AI request, billed snapshot, credential change or research mutation
was made.

## Verification

- 121 frontend tests, formatting, TypeScript/production build and diff checks pass.
- Desloppify web scan/status/next: no changes since the previous scan; overall
  21.9, objective 87.8, strict 20.5, verified 87.8; 72 open findings, including
  20 unassessed subjective dimensions. Existing findings are not repaired or
  treated as research-accuracy scores by this focused deployment.
- Live `/`, `/guide`, `/example`, `/app`, `/api/health`: HTTP 200.
- Unauthenticated `/api/theses` and `/api/llm/status`: HTTP 401.
- Browser: homepage omits the requested footer text; Guide retains it; app
  presents Google sign-in in the verification browser. No Google login was clicked.
- Existing bundle-size and Zod annotation build warnings remain.

The user's signed-in recording and any new AI calls are separate actions.
