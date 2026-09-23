# Self-Hosted Supabase Setup

This document covers how to replace the managed Supabase cloud project with a self-hosted instance running on a local Linux machine. Zero application code changes are required — only environment variables change.

## Why self-host?

The Supabase free tier pauses projects after inactivity. Self-hosting on a local Linux machine eliminates that, at zero cost.

## Multiple projects on the same server

Each project runs as a separate Docker Compose stack with unique container names, ports, and networks. The server currently runs two stacks:

| Project | Directory | API port | Pooler port |
|---|---|---|---|
| betaapp | `~/supabase/docker/` | 8000 | 6543 |
| moviedb | `~/supabase-moviedb/docker/` | 8100 | 6544 |

See `/c/web/moviedb/docs/self-hosted-supabase.md` for moviedb-specific setup.

### Critical: use hex passwords only

Always generate `POSTGRES_PASSWORD` and `JWT_SECRET` with `openssl rand -hex 24` — **never** `openssl rand -base64`. Base64 output contains `/`, `+`, `=` which break URL parsing in GoTrue, supavisor, and PostgREST connection strings.

### Internal role password fix

If `POSTGRES_PASSWORD` changes after first init, the baked-in role passwords won't match. Fix with:

```bash
docker exec <db-container> psql -U supabase_admin -c "ALTER USER authenticator WITH PASSWORD '<password>';"
docker exec <db-container> psql -U supabase_admin -c "ALTER USER supabase_auth_admin WITH PASSWORD '<password>';"
docker exec <db-container> psql -U supabase_admin -c "ALTER USER postgres WITH PASSWORD '<password>';"
```

## Architecture Overview

Self-hosted Supabase is the same stack running locally via Docker Compose: Envoy (API gateway), GoTrue (auth), PostgREST (REST API), Realtime (WebSocket), Storage (file storage), and PostgreSQL. The `@supabase/supabase-js` SDK talks to it identically — nothing in the app changes.

---

## Prerequisites

- Linux machine (Ubuntu 20.04+ or Debian 12+ recommended) with at least 4 GB RAM
- Docker and Docker Compose installed
- Tailscale installed (for access from your phone outside the home network)

### Install Docker (if not already installed)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

### Install Tailscale (recommended)

Tailscale creates a private network between your Linux machine and your phone — no port forwarding, no public exposure.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Install the Tailscale app on your Android device and sign in with the same account. Your Linux machine gets a stable `100.x.x.x` IP that your phone can always reach, regardless of where you are.

---

## Step 1 — Clone the Supabase self-hosting repo

```bash
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
```

---

## Step 2 — Configure the `.env` file

Open `.env` and set the following. Everything else can stay at its default for local use.

### Generate secrets

```bash
# JWT secret — must be at least 32 characters
openssl rand -hex 32

# Postgres password
openssl rand -hex 24

# Dashboard password (for the Supabase Studio UI)
openssl rand -hex 16
```

### Required changes in `.env`

```env
# Postgres
POSTGRES_PASSWORD=<generated above>

# JWT — used to sign auth tokens
JWT_SECRET=<generated above>
# Re-generate the ANON and SERVICE keys using https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
ANON_KEY=<generated>
SERVICE_ROLE_KEY=<generated>

# The URL your machine is reachable at — use Tailscale IP
SITE_URL=http://100.x.x.x:8000
API_EXTERNAL_URL=http://100.x.x.x:8000

# Studio dashboard
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<generated above>

# SMTP — needed for magic link and password reset emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password   # Gmail app password, not your account password
SMTP_SENDER_NAME=BetaApp
```

### Generate ANON and SERVICE_ROLE keys

Use the Supabase JWT generator. Given your `JWT_SECRET`, run:

```bash
# Install jose if needed: npm install -g jose
node -e "
const { SignJWT } = require('jose');
const secret = new TextEncoder().encode('YOUR_JWT_SECRET');

async function gen(role) {
  return new SignJWT({ role, iss: 'supabase' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2050-01-01')
    .sign(secret);
}

gen('anon').then(t => console.log('ANON_KEY=', t));
gen('service_role').then(t => console.log('SERVICE_ROLE_KEY=', t));
"
```

Or use the online tool at: `https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys`

---

## Step 3 — Slim down the stack (optional but recommended)

If RAM is tight, disable services you don't use. Open `docker-compose.yml` and comment out or remove these services:

- `analytics` — Logflare analytics (not used)
- `vector` — log aggregation (not used)
- `imgproxy` — image transformations (not used in BetaApp)

This saves roughly 1-1.5 GB of RAM, bringing idle usage down to ~2-2.5 GB.

---

## Step 4 — Start the stack

```bash
docker compose up -d
```

Check that all containers are running:

```bash
docker compose ps
```

The Supabase Studio UI will be available at `http://localhost:8000` (or your Tailscale IP on port 8000).

---

## Step 5 — Run existing migrations

BetaApp's migrations live in `supabase/migrations/`. Connect to the new PostgreSQL instance and run them in order.

```bash
# Connect to the Postgres container
docker exec -it supabase-db-1 psql -U postgres -d postgres

# Or use psql locally (port 5432 is exposed)
psql -h localhost -p 5432 -U postgres -d postgres
```

Run each migration file from `supabase/migrations/` in chronological order. Alternatively, use the Supabase CLI:

```bash
supabase db push --db-url postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres
```

This applies all migrations in `supabase/migrations/` automatically.

---

## Step 6 — Migrate existing data (optional)

If you want to bring your existing cloud data over, follow this exact process. Several gotchas apply.

### Why the hosted DB direct connection doesn't work

The hosted Supabase direct connection (`db.<ref>.supabase.co:5432`) is IPv6-only by default. The self-hosted server can't reach it. Use the **session pooler** URL instead — it accepts IPv4. Find it in:

**Supabase dashboard → Project Settings → Database → Session pooler** (port 5432, not 6543)

The URL looks like: `postgresql://postgres.<ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres`

### Install pg_dump locally (Windows)

The Supabase CLI `db dump` command requires Docker locally. Use `pg_dump` from PostgreSQL instead:

```powershell
winget install PostgreSQL.PostgreSQL.17
# pg_dump won't be on PATH — use the full path:
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" --version
```

### Dump from hosted Supabase

Run two separate dumps from PowerShell — auth users (needed for login) and all public data:

```powershell
# Auth users and identities (needed so existing accounts can log in)
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" "postgresql://postgres.<ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres" --data-only --no-owner --no-privileges -t auth.users -t auth.identities -f C:\temp\betaapp_auth.sql

# All public schema data
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" "postgresql://postgres.<ref>:[PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres" --data-only --no-owner --no-privileges --schema=public -f C:\temp\betaapp_public.sql
```

Create `C:\temp` first if it doesn't exist: `mkdir C:\temp`

### Copy dumps to server and restore

```bash
# Copy to server
scp C:\temp\betaapp_auth.sql C:\temp\betaapp_public.sql seth@100.85.209.13:/tmp/

# SSH in and restore — session_replication_role bypasses FK ordering during import
ssh seth@100.85.209.13
(echo "SET session_replication_role = replica;" && cat /tmp/betaapp_auth.sql && cat /tmp/betaapp_public.sql && echo "SET session_replication_role = DEFAULT;") | docker exec -i supabase-db psql -U postgres -d postgres
```

### Post-import: fix UUID mismatches

After import, the UUIDs in `auth.users` may not match the UUIDs in the public schema tables (this happens when the self-hosted GoTrue creates a new account on first login). Check:

```bash
docker exec supabase-db psql -U postgres -d postgres -c "SELECT id, email FROM auth.users;"
docker exec supabase-db psql -U postgres -d postgres -c "SELECT DISTINCT user_id FROM climbs LIMIT 5;"
```

If they differ, update all user-owned tables to use the correct UUID:

```bash
OLD="<old-uuid>"
NEW="<auth-uuid>"
docker exec supabase-db psql -U postgres -d postgres -c "UPDATE climbs SET user_id = '$NEW' WHERE user_id = '$OLD';"
docker exec supabase-db psql -U postgres -d postgres -c "UPDATE burns SET user_id = '$NEW' WHERE user_id = '$OLD';"
docker exec supabase-db psql -U postgres -d postgres -c "UPDATE user_roles SET user_id = '$NEW' WHERE user_id = '$OLD';"
docker exec supabase-db psql -U postgres -d postgres -c "UPDATE profiles SET id = '$NEW' WHERE id = '$OLD';"
```

### Post-import: fix schema drift

The public schema on the self-hosted instance was created at setup time and may be missing columns added by later app migrations. After import, check for errors like `PGRST204: Could not find the '<column>' column`. Fix with:

```bash
# Example: offline_available column added in v32
docker exec supabase-db psql -U postgres -d postgres -c "ALTER TABLE climbs ADD COLUMN IF NOT EXISTS offline_available INTEGER NOT NULL DEFAULT 0;"

# After any ALTER TABLE, reload PostgREST's schema cache
docker kill --signal=SIGUSR1 supabase-rest
```

If you'd rather start fresh, skip this step — the app will re-sync local device data on next launch.

---

## Step 7 — Re-deploy the auth-redirect Edge Function

The `auth-redirect` Edge Function handles PKCE code exchange for magic link and password reset emails.

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Point CLI at your self-hosted instance
supabase functions deploy auth-redirect \
  --project-ref local \
  --db-url postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres
```

> **Note:** Self-hosted Edge Functions are in beta. If deployment fails, the workaround is to handle the redirect in a small standalone server (e.g., a Node.js express app listening on a separate port). The function itself is only ~30 lines — see `supabase/functions/auth-redirect/index.ts`.

---

## Step 8 — Update BetaApp environment variables

In `C:/web/betaapp/tauri/betaapp/`, edit `.env.local`:

```env
VITE_SUPABASE_URL=http://100.x.x.x:8000
VITE_SUPABASE_ANON_KEY=<your new ANON_KEY from Step 2>
```

Also update `src/features/auth/auth.service.ts` — the `AUTH_REDIRECT_URL` constant points to the Supabase Edge Function URL. Change it to your self-hosted URL:

```ts
// Before:
const AUTH_REDIRECT_URL = 'https://tkiacbpbfwzhvschjavh.supabase.co/functions/v1/auth-redirect'

// After:
const AUTH_REDIRECT_URL = 'http://100.x.x.x:8000/functions/v1/auth-redirect'
```

---

## Step 9 — Verify

1. Open Supabase Studio at `http://100.x.x.x:8000` — confirm tables exist
2. Build and run BetaApp: `cargo tauri android dev`
3. Sign in with email/password — confirm auth works
4. Trigger a sync — confirm climbs push/pull correctly
5. Check Realtime: make a change in Studio and confirm it arrives in the app

---

## Keeping it running

### Auto-start on boot

```bash
# Create a systemd service so Docker Compose starts automatically
sudo nano /etc/systemd/system/supabase.service
```

```ini
[Unit]
Description=Supabase Self-Hosted
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/<user>/supabase/docker
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=<user>

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable supabase
sudo systemctl start supabase
```

### Updates

```bash
cd ~/supabase/docker
git pull
docker compose pull
docker compose up -d
```

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Phone can't reach the server | Confirm Tailscale is running on both: `tailscale status` |
| Auth emails not sending | Check SMTP credentials and Gmail app password setting |
| Container OOM (out of memory) | Disable `analytics`, `vector`, `imgproxy` in docker-compose.yml |
| PostgREST 401 errors | Regenerate ANON_KEY — it must match JWT_SECRET exactly |
| Realtime not connecting | Check that port 8000 is accessible from your Tailscale IP |
| Edge Function deploy fails | Use standalone Node.js redirect server as fallback (see Step 7) |
| `pg_dump` can't reach hosted DB | Hosted direct connection is IPv6-only — use the session pooler URL instead (see Step 6) |
| Sync RLS error after import | UUIDs in public schema don't match auth.users — run the UUID fix queries in Step 6 |
| `PGRST204: column not found` after import | Schema drift — run `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` then reload PostgREST: `docker kill --signal=SIGUSR1 supabase-rest` |
| Release APK sync fails, dev works | CSP blocks the HTTP self-hosted URL — see `docs/android.md` CSP section |
| `supabase-pooler` or `supabase-edge-functions` restarting | Not critical for betaapp — auth, REST, Realtime, and DB are the required services |

---

## Key file locations

| What | Path |
|---|---|
| Docker Compose config | `~/supabase/docker/docker-compose.yml` |
| Environment variables | `~/supabase/docker/.env` |
| App env vars | `C:/web/betaapp/tauri/betaapp/.env.local` |
| Auth redirect URL | `src/features/auth/auth.service.ts` — `AUTH_REDIRECT_URL` constant |
| Edge Function source | `supabase/functions/auth-redirect/index.ts` |
| Migrations | `supabase/migrations/` |
