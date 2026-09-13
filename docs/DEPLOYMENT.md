# Deployment

AWS Lightsail is the selected host. The private demo runs at `https://revisoagent.xyz` on the 2 GB Ubuntu `reviso-prod` instance in `us-east-1a` with attached static IP `13.216.59.120`. Vercel is authoritative DNS only; the application itself runs on Lightsail. Caddy provides trusted HTTPS and HTTP Basic authentication; SQLite and Caddy state use named Docker volumes. The deployed smoke test passed through the initial temporary hostname and final-domain HTTPS plus persisted-state checks passed again after cutover.

## Local production-shaped preview

The container builds the React application, installs locked Python and Node dependencies, serves the browser app and `/api` from one FastAPI origin, and stores SQLite under `/app/data` on a named volume. Provider keys are runtime environment values; neither the build context nor image receives `.env`.

```sh
docker compose build
docker compose up
```

Open `http://127.0.0.1:8080`. Compose deliberately publishes only to loopback. Stop it with `docker compose down`; do not add `--volumes` unless deleting the preview database is intentional.

## Public-demo gate

Do not expose the service until a host is selected and HTTPS is available. Public mode fails closed unless all of these are configured at runtime:

```text
REVISO_PUBLIC_DEMO=1
REVISO_ALLOWED_HOSTS=demo.example
REVISO_ALLOWED_ORIGINS=https://demo.example
REVISO_DEMO_USERNAME=<runtime secret>
REVISO_DEMO_PASSWORD=<runtime secret of at least 16 characters>
BITGET_QWEN_API_KEY=<runtime secret>
```

The browser uses HTTP Basic authentication over the host's required HTTPS connection. This is appropriate for a limited hackathon demo, not a multi-user product. The application still lacks accounts, per-user record isolation, audit administration, rate limiting and encrypted database backups. SQLite requires a persistent volume and a single application replica. Scaling horizontally would require a different repository implementation.

The reverse proxy must preserve the original `Host` header. Add only the final HTTPS origin and hostname to the allowlists. Never use wildcard hosts, put provider or demo credentials in frontend variables, bake `.env` into the image, or deploy the local Compose port mapping as a public listener.

## AWS Lightsail target

AWS Lightsail is the selected deployment target. The prepared stack under
[`deploy/aws`](../deploy/aws/README.md) adds Caddy HTTPS termination to the
existing application image and stores SQLite plus TLS state in named Docker
volumes on the instance SSD. Start with one 2 GB Ubuntu instance, one static IP
and one DNS A record. Keep a single application replica while SQLite is the
repository.

The instance was created through the scoped IAM user `reviso-deployer`, not the
AWS root identity. TCP 22 is restricted to the administrator IP observed during
deployment; TCP 80/443 are public. Registry delegation, the final A record and
the runtime hostname/allowlist cutover are complete. The remaining steps are a
final authenticated browser walkthrough and, after explicit approval of billed
snapshot storage, automatic snapshots. See the dated deployment report under
`docs/evaluations` for the verified state and limitations.
