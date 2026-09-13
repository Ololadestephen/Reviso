# AWS live deployment smoke test — 2026-09-12

Reviso was deployed through the scoped IAM user `reviso-deployer`, not the AWS
root identity. The target is one Ubuntu 24.04 Lightsail instance named
`reviso-prod` in `us-east-1a`, using the 2 GB bundle and attached static IP
`13.216.59.120`. SSH was restricted to the administrator's observed `/32`; TCP
80 and 443 were opened publicly. Docker Compose runs one Reviso container and
one Caddy container. Named volumes retain SQLite, Caddy certificates and Caddy
configuration.

The purchased `revisoagent.xyz` domain did not yet have registry nameserver
delegation during the initial test. A temporary hostname resolving to the same
static IP was therefore used to validate trusted Let's Encrypt HTTPS without
weakening authentication. Vercel DNS subsequently published the final A record,
Caddy and the application allowlists were switched to `revisoagent.xyz`, and the
temporary hostname ceased serving TLS.

Verified results:

- unauthenticated health request: HTTP 401;
- authenticated health request: HTTP 200, `private_demo` mode;
- TLS verification: success;
- configured provider: `bitget-qwen` / `qwen3.8-max`, prompt versions v2;
- one user-level live extraction action: HTTP 200, preserving the two metric
  floors, numerical risk fields and token-versus-share distinction;
- the reviewed proposal was then saved and explicitly confirmed as version 2;
- public refresh: Bitget market availability `AVAILABLE`, NVIDIA disclosure
  availability `AVAILABLE`, one NVIDIA Newsroom record, reported revenue growth
  106% and GAAP gross margin 75.0%;
- deterministic state: `SUPPORTED`;
- one user-level live evidence-review action: both assumptions `SUPPORTS`, with
  citations limited to the selected NVIDIA evidence;
- after restarting only the Reviso application container, the two stored thesis
  versions, two assessments, selected state, review provider/model and deep SPA
  timeline route remained available;
- after recreating the application and Caddy containers for the final-domain
  cutover, authenticated health, TLS, the deep timeline route and the same
  persisted thesis state remained available at `https://revisoagent.xyz`.

The ordinary application response does not expose whether either AI action used
its one permitted internal schema repair, so the defensible accounting is two
user-level Qwen actions and two-to-four provider requests. No trade was placed,
no brokerage account was connected and no subjective accuracy claim follows
from this smoke test.

An initial server build failed closed because macOS tar metadata created
AppleDouble sidecars whose `.sql` suffix matched the migration glob. The real
migrations were intact. Generated sidecars were removed and `.dockerignore`
plus `.gitignore` now exclude `.DS_Store` and `._*`; the rebuilt application
started successfully. The final-domain DNS cutover is complete. A final deployed
browser walkthrough remains pending, and automatic snapshots require explicit
approval because they add billed snapshot storage.
