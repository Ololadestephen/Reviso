# AWS Lightsail deployment

This package deploys the existing Reviso container to one Ubuntu Lightsail
instance. Caddy terminates HTTPS and proxies the application. The `reviso-data`
Docker volume stores SQLite on the instance SSD; `caddy-data` retains TLS
certificates. Keep one application replica while SQLite is in use.

## Target

- AWS region: `us-east-1` unless deliberately changed
- Lightsail Linux bundle: 2 GB RAM / 60 GB SSD is the recommended starting size
- Instance firewall: TCP 22 from an administrator IP, TCP 80 and 443 publicly;
  UDP 443 is optional for HTTP/3
- Static IP: attach before creating DNS
- DNS: one A record for the final demo hostname pointing at the static IP
- Backups: enable daily Lightsail automatic snapshots after the first successful
  smoke test

Do not create infrastructure from the AWS root identity. Use an administrator or
deployment role with Lightsail permissions, MFA and a short-lived CLI session.

## Current deployment

As of September 13, 2026, `reviso-prod` is running in `us-east-1a` on the 2 GB
bundle with static IP `13.216.59.120`. It was provisioned through the scoped IAM
user `reviso-deployer`. Vercel DNS points `revisoagent.xyz` at the static IP and
`REVISO_HOST` has been switched to that final hostname. HTTPS, Basic Auth, Qwen
configuration, public evidence refresh and SQLite persistence passed on the
initial temporary hostname; final-domain HTTPS and persisted-state checks also
passed after cutover. The six-stock, automatic-findings and inline-conversation
release was subsequently deployed with migration 005 after integrity-checked
online SQLite backups; the named data and Caddy volumes were preserved.

## Install the host

Create an Ubuntu 24.04 Lightsail instance, attach a static IP and configure its
firewall. Connect over SSH, copy this repository to `/opt/reviso`, then run:

```sh
cd /opt/reviso
sudo deploy/aws/bootstrap-ubuntu.sh
```

Sign out and back in so the Docker group applies.

## Configure runtime secrets

From `/opt/reviso`:

```sh
cp deploy/aws/.env.example deploy/aws/.env
chmod 600 deploy/aws/.env
```

Set the final hostname, a random demo password of at least 16 characters and the
Bitget Qwen key in `deploy/aws/.env`. The file is ignored by Git through the
repository-wide `.env.*` rule. The hostname must already resolve to the static
IP so Caddy can obtain its certificate.

Validate and start the service:

```sh
docker compose --env-file deploy/aws/.env -f deploy/aws/compose.yaml config --quiet
docker compose --env-file deploy/aws/.env -f deploy/aws/compose.yaml up -d --build
docker compose --env-file deploy/aws/.env -f deploy/aws/compose.yaml ps
```

Open `https://<REVISO_HOST>` and enter the demo credentials. Verify
`https://<REVISO_HOST>/api/health`, create a temporary thesis, restart the
containers and confirm the thesis remains present.

## Update and roll back

Before updating, make an on-host SQLite backup and an automatic Lightsail
snapshot. Pull or copy the reviewed source, then rebuild with the same `up`
command. Docker Compose preserves `reviso-data` unless the volume is explicitly
removed. Never run `docker compose down --volumes` on the deployed host.

To roll back, restore the last instance snapshot or deploy the previous reviewed
source archive. A Lightsail instance snapshot is the recovery boundary for the
current single-host SQLite design.
