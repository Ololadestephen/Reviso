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

No Qwen request was made during deployment or smoke testing. Automatic
Lightsail snapshots remain disabled because billed snapshot storage has not
been separately approved. The earlier live suggestion timeouts and contract
rejection remain open product limitations.
