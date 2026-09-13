# AWS deployment rehearsal — 2026-09-12

AWS Lightsail was selected as Reviso's hosting target. The local deployment
package uses the existing application image, Caddy-managed HTTPS and named
Docker volumes for SQLite and TLS state. No AWS resource, DNS record or public
service was created during this rehearsal.

## Prepared files

- `deploy/aws/compose.yaml`: one Reviso container and one Caddy container,
  runtime-only provider/demo credentials, read-only application root filesystem,
  `no-new-privileges` and persistent named volumes.
- `deploy/aws/Caddyfile`: automatic HTTPS, compression, security headers and
  reverse proxying to the private application port.
- `deploy/aws/bootstrap-ubuntu.sh`: installs Docker Engine and Compose from the
  official Docker Ubuntu repository and prepares `/opt/reviso`.
- `deploy/aws/.env.example`: placeholders for the final hostname, browser
  credentials and server-only Qwen credentials.
- `deploy/aws/README.md`: instance, firewall, DNS, startup, update, backup and
  rollback procedure.

## Local verification

The Compose file rendered successfully with placeholder values, the Ubuntu
bootstrap script passed shell syntax validation, and Caddy 2.10.2 accepted the
configuration. A production-shaped local stack then passed these checks:

| Check | Result |
| --- | --- |
| HTTPS without browser credentials | HTTP 401 |
| HTTPS with temporary browser credentials | HTTP 200 |
| Health deployment mode | `private_demo` |
| SQLite after application restart | Smoke-test thesis preserved |
| SQLite after application image rebuild/replacement | Smoke-test thesis preserved |
| Qwen usage | None; the temporary environment intentionally had no provider key |

The misleading hard-coded `local_single_user` health label found during this
rehearsal was corrected and covered by deployment tests. The full backend suite
then passed: 75 tests, with the same two upstream TestClient deprecation
warnings. Ruff checks and formatting also passed.

## Remaining account work

The AWS CLI defaults to `us-east-1`, but its session is expired and its saved
login session targets the AWS root identity. Infrastructure must be created
through a short-lived, MFA-protected non-root administrator/deployment identity.
The final hostname is also still required before Caddy can request a public TLS
certificate.

After those two inputs are available: create one 2 GB Ubuntu Lightsail instance,
attach a static IP, restrict SSH to the administrator address, open HTTP/HTTPS,
create the DNS A record, transfer the reviewed source, start the stack, enable
automatic snapshots and repeat the authenticated browser/persistence smoke test
against the public hostname.
