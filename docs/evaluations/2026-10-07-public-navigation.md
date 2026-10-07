# Public-page scroll fix — 7 October 2026

The shared public layout remained mounted across client-side links, leaving the
new article at the previous page's window scroll position. The layout now resets
the window to the top before paint when its pathname changes. Explicit `instant`
behaviour overrides the site's smooth-scroll CSS. Normal scrolling and layout
rerenders on the same page do not reset the viewport.

Only public navigation changed. Research routes, saved records, AI prompts,
provider configuration and database contracts are unchanged. The earlier local
homepage disclaimer edit is preserved. No commit, push, deployment or AI request
was made for this follow-up.

## Verification

- Regression tests first failed for Privacy, Terms, Guide and NVIDIA example
  footer links, then passed after the fix. A fifth test ensures scrolling within
  a page does not trigger a reset. jsdom's unimplemented scroll API is stubbed;
  real viewport behaviour was separately checked in the browser.
- 126 frontend tests, Prettier, TypeScript/production build and diff checks pass.
- Browser at localhost: landing scrolled to 2618px → footer Privacy → scrollY 0;
  Privacy scrolled to 903px → footer Terms → scrollY 0. Correct page headings
  rendered. No backend or AI request was needed for these public pages.
- Existing bundle-size, Zod annotation and test-runtime localStorage warnings
  remain. Backend scanning/testing was not repeated for a public-layout-only fix.

## Desloppify before and after

Separate web scan/status/next reported no new findings: 72 open. The pending
subjective review is unchanged and was not fabricated or expanded into this fix.

| Score | Before | After |
| --- | --- | --- |
| Overall | 21.9 | 21.9 |
| Objective | 87.8 | 87.8 |
| Strict | 20.5 | 20.5 |
| Verified | 87.8 | 87.8 |

| Mechanical dimension | Health | Strict |
| --- | --- | --- |
| Code quality | 97.1 | 95.3 |
| Duplication | 100.0 | 100.0 |
| File health | 98.8 | 98.8 |
| Security | 100.0 | 100.0 |
| Test health | 57.6 | 37.2 |

| Subjective dimension | Score/status |
| --- | --- |
| Abstraction fit | 0, unassessed |
| AI generated debt | 0, unassessed |
| API coherence | 0, unassessed |
| Authorization consistency | 0, unassessed |
| Contracts | 0, unassessed |
| Convention outlier | 0, unassessed |
| Cross-module architecture | 0, unassessed |
| Dependency health | 0, unassessed |
| Design coherence | 0, unassessed |
| Error consistency | 0, unassessed |
| High elegance | 0, unassessed |
| Incomplete migration | 0, unassessed |
| Initialization coupling | 0, unassessed |
| Logic clarity | 0, unassessed |
| Low elegance | 0, unassessed |
| Mid elegance | 0, unassessed |
| Naming quality | 0, unassessed |
| Package organization | 0, unassessed |
| Test strategy | 0, unassessed |
| Type safety | 0, unassessed |

These are code-health scores, not research-accuracy or hackathon scores.

## Subsequently approved AWS deployment

The user approved deployment after local verification. The tested component was
copied to the existing AWS checkout and only the application container rebuilt
and recreated. This is an uncommitted working-tree deployment; no Git commit or
push was performed. Component SHA-256:
`af6097114ddd2f1831f432ae57828e11ffa40220a9929f58d623bcb67af45de5`.
The live browser loaded `index-BCIjczmq.js`.

Online production backup:
`/app/data/backups/reviso-before-scroll-20261007T181743Z.sqlite3`.
Integrity: `ok`, permissions 0600, SHA-256:
`55573e9af24bb41f288e1b714dec5c571a3f321b17f08d6be44505283d01ea6f`.
All rows in users, identities, theses, assessments, assessment selection, events,
answers, threads and migration history matched the backup after deployment.
Live database integrity passed. The environment fingerprint is unchanged and
Caddy and persistent volumes were retained. Prior source and app image are
recoverable under `/home/ubuntu/reviso-release-backups/scroll-20261007T181743Z/`
and `reviso-reviso:before-scroll-20261007T181743Z` respectively.

Live browser verification: scroll to the footer, follow Privacy, Terms, Guide
and NVIDIA example links in sequence; every destination rendered its heading
with `window.scrollY === 0`. Home, all four article pages, app and health returned
HTTP 200; unauthenticated theses and LLM status returned HTTP 401.
No AI call, notebook mutation, credential change, billed snapshot or additional
firewall rule was needed for this deployment.
