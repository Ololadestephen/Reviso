# Six-stock evidence conversation deployment — 2026-09-13

The reviewed release in commits `a9b615d` and `61a21ab` was pushed to `main` and
deployed to the existing `reviso-prod` Lightsail instance through the scoped
`reviso-deployer` IAM user. The root login profile was expired and was not used.
SSH remained restricted to the administrator's current single IPv4 `/32`.

Before the update, an online SQLite backup named
`reviso-before-61a21ab-20260913T174500Z.sqlite3` was created in the persistent
data volume and returned `ok` from `pragma integrity_check`. The reviewed Git
archive replaced application source only. `deploy/aws/.env`, the SQLite volume,
and both Caddy volumes were preserved. The Reviso image rebuilt successfully and
the application container restarted without recreating Caddy.

Production verification passed:

- unauthenticated `/`, `/guide` and `/example`: HTTP 200;
- unauthenticated `/app` and `/api/health`: HTTP 401;
- Reviso mark and all six exact stock-logo paths: HTTP 200;
- authenticated health: HTTP 200 in `private_demo` mode;
- configured provider: `bitget-qwen` / `qwen3.8-max`;
- instruments: NVIDIA `RNVDAUSDT`, Apple `RAAPLUSDT`, Microsoft `RMSFTUSDT`,
  Alphabet `RGOOGLUSDT`, Amazon `RAMZNUSDT`, and Tesla `RTSLAUSDT`;
- the previously saved thesis remained present after the rebuild;
- SQLite migrations 1–4 were present and the live database integrity check was
  `ok`;
- the deployed landing page rendered with the reviewed hero, six-company
  coverage and application CTA.

The disposable local visual review then exposed an invalid foreign key left by
an earlier experimental `research_threads` schema. Production's clean migration
004 was unaffected, but existing local databases could return HTTP 500. Commit
`eafb1c5` adds a data-preserving migration 005 and one-time numbered migration
execution. The full 105-test backend suite and a copied legacy database passed.
A second online backup named
`reviso-before-eafb1c5-20260913T175800Z.sqlite3` passed integrity checking before
the repair was deployed. Production retained its saved conversation, reported
migrations 1–5 with database integrity `ok`, and returned HTTP 200 from the
conversation endpoint.

No Qwen request was made during deployment or smoke testing. Automatic
Lightsail snapshots remain disabled because billed snapshot storage has not
been separately approved. The earlier live suggestion timeouts and contract
rejection remain open product limitations.
