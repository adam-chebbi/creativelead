# AutoReach V2 — Production Deployment Runbook
### Target: `leads.creativecomet.tn` → VPS `54.37.159.215`

> [!IMPORTANT]
> Run every step **in order**. Each step depends on the previous one completing successfully.
> All commands are run on the **VPS via SSH** unless marked 🖥️ (local machine) or ⚙️ (GitHub UI).

---

## Pre-flight Checklist

Before you begin, confirm the following:

- [ ] You have SSH access to `54.37.159.215`
- [ ] Port conflicts on port `3030` are resolved (your VPS monitor showed this)
- [ ] The DNS A record for `leads.creativecomet.tn` points to `54.37.159.215`
- [ ] Docker and Docker Compose v2 are installed on the VPS
- [ ] Your GitHub repo is up to date with all the code changes from this session

---

## Step 1 — Connect to VPS

```bash
# 🖥️ From your local machine
ssh root@54.37.159.215
```

---

## Step 2 — Install Docker (if not already installed)

```bash
# Check if already installed — skip this step if it prints a version
docker --version
docker compose version

# If NOT installed:
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker
```

---

## Step 3 — Clone the Repository

```bash
# Create the project directory
mkdir -p /var/www/autoreach
cd /var/www/autoreach

# Clone your repository (replace with your actual repo URL)
git clone https://github.com/YOUR_USERNAME/autoreach.git .

# Verify the key files are present
ls docker-compose.yml deploy.sh nginx/autoreach.conf
```

---

## Step 4 — Create the `.env` File

```bash
cd /var/www/autoreach

# Copy the example file
cp .env.example .env

# Open and fill in EVERY value
nano .env
```

> [!CAUTION]
> Generate real values for secrets — do NOT use placeholder strings in production.

**Generate each secret with these commands (run them one by one, copy each output):**

```bash
# NEXTAUTH_SECRET (32 random bytes, base64)
openssl rand -base64 32

# ENCRYPTION_KEY (32 random bytes, hex — must be exactly 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# WORKER_SECRET (32 random bytes, hex)
openssl rand -hex 32

# POSTGRES_PASSWORD (strong random password)
openssl rand -base64 24
```

**Your completed `.env` should look like this:**

```dotenv
POSTGRES_USER=autoreach
POSTGRES_PASSWORD=<output from openssl>
POSTGRES_DB=autoreach

DATABASE_URL=postgresql://autoreach:<POSTGRES_PASSWORD>@postgres:5432/autoreach
DIRECT_URL=postgresql://autoreach:<POSTGRES_PASSWORD>@postgres:5432/autoreach

NEXTAUTH_SECRET=<output from openssl rand -base64 32>
NEXTAUTH_URL=https://leads.creativecomet.tn

GITHUB_CLIENT_ID=<from github.com/settings/developers>
GITHUB_CLIENT_SECRET=<from github.com/settings/developers>
GOOGLE_CLIENT_ID=<from console.cloud.google.com>
GOOGLE_CLIENT_SECRET=<from console.cloud.google.com>

ENCRYPTION_KEY=<64 hex chars from node crypto>
WORKER_SECRET=<output from openssl rand -hex 32>

RESEND_API_KEY=re_<your key>
RESEND_FROM_EMAIL=outreach@leads.creativecomet.tn
RESEND_WEBHOOK_SECRET=whsec_<from Resend dashboard>

APP_BASE_URL=https://leads.creativecomet.tn
NODE_ENV=production
```

---

## Step 5 — Create Required Directories

```bash
cd /var/www/autoreach

# Download directory for Electron installers
mkdir -p public/downloads

# Certbot volumes (created empty — Certbot will populate them)
mkdir -p certbot/conf certbot/www
```

---

## Step 6 — Start Nginx (HTTP only, for SSL challenge)

We start Nginx first in HTTP-only mode so Certbot can verify domain ownership.

```bash
cd /var/www/autoreach

# Temporarily use an HTTP-only nginx config
# We need to comment out the SSL lines until we have a cert
# The docker-compose nginx will serve the certbot challenge on port 80
docker compose up -d nginx
```

> [!NOTE]
> If nginx fails to start because the SSL cert doesn't exist yet, replace the nginx config temporarily:
>
> ```bash
> # Backup the full config
> cp nginx/autoreach.conf nginx/autoreach.conf.bak
>
> # Create a minimal HTTP-only config just for cert issuance
> cat > nginx/autoreach.conf << 'EOF'
> server {
>     listen 80;
>     server_name leads.creativecomet.tn;
>     location /.well-known/acme-challenge/ {
>         root /var/www/certbot;
>     }
>     location / { return 200 "ok"; }
> }
> EOF
>
> docker compose restart nginx
> ```

---

## Step 7 — Obtain SSL Certificate (one-time)

```bash
# Run Certbot in standalone mode using the certbot Docker image
docker run --rm \
  -v /var/www/autoreach/certbot/conf:/etc/letsencrypt \
  -v /var/www/autoreach/certbot/www:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    -d leads.creativecomet.tn \
    --email admin@creativecomet.tn \
    --agree-tos \
    --no-eff-email

# Verify the cert was issued
ls /var/www/autoreach/certbot/conf/live/leads.creativecomet.tn/
# Should show: cert.pem  chain.pem  fullchain.pem  privkey.pem
```

---

## Step 8 — Restore Full Nginx Config & Reload

```bash
cd /var/www/autoreach

# If you temporarily replaced the config in Step 6, restore it:
cp nginx/autoreach.conf.bak nginx/autoreach.conf

# Reload nginx with the full SSL config
docker compose exec nginx nginx -s reload
# If that fails, do a full restart:
docker compose restart nginx
```

---

## Step 9 — Start PostgreSQL

```bash
cd /var/www/autoreach

docker compose up -d postgres

# Wait for it to be ready (takes ~5 seconds)
sleep 5

# Verify it's running
docker compose ps postgres
# Status should show: running (healthy) or Up X seconds
```

---

## Step 10 — Build and Start the API

```bash
cd /var/www/autoreach

# Build the API Docker image
docker compose build api

# Start the API — it will auto-run prisma migrate deploy on startup
docker compose up -d api

# Watch the startup logs
docker compose logs -f api
# Wait until you see: [API] Creative Leads API Bridge running on port 3070
# and:               [DB] Connected to PostgreSQL via Prisma
# Press Ctrl+C to stop following logs
```

---

## Step 11 — Build and Start the Dashboard

```bash
cd /var/www/autoreach

# Build the dashboard (Next.js standalone — takes 2-3 minutes)
docker compose build dashboard

# Start the dashboard
docker compose up -d dashboard

# Watch the startup logs
docker compose logs -f dashboard
# Wait until you see: Ready - started server on 0.0.0.0:3040
# Press Ctrl+C to stop following logs
```

---

## Step 12 — Verify Everything Is Running

```bash
# All 4 containers should show "Up"
docker compose ps

# Test API health endpoint
curl -s https://leads.creativecomet.tn/api/health
# Expected: {"status":"ok","timestamp":"...","version":"2.0.0"}

# Test dashboard
curl -s -o /dev/null -w "%{http_code}" https://leads.creativecomet.tn
# Expected: 200

# Test SSE endpoint headers (ctrl+c after 2 seconds)
curl -v https://leads.creativecomet.tn/api/dashboard/stream 2>&1 | head -30
# Expected: Content-Type: text/event-stream
# Expected: X-Accel-Buffering: no
```

---

## Step 13 — Set Up SSL Auto-renewal

```bash
# Add to root crontab
crontab -e

# Add this line (renews daily at noon, reloads nginx on success):
0 12 * * * certbot renew --quiet && docker compose -f /var/www/autoreach/docker-compose.yml exec nginx nginx -s reload
```

---

## Step 14 — Set GitHub Actions Secrets

> ⚙️ Do this in the GitHub UI: **Repo → Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value |
|---|---|
| `VPS_HOST` | `54.37.159.215` |
| `VPS_USER` | `root` (or your deploy username) |
| `VPS_SSH_KEY` | Your private SSH key (the full contents of `~/.ssh/id_rsa`) |
| `WORKER_SECRET` | Same value as `WORKER_SECRET` in your VPS `.env` |

**Generate an SSH key pair for CI if you don't have one:**

```bash
# 🖥️ On your local machine
ssh-keygen -t ed25519 -C "github-actions-autoreach" -f ~/.ssh/autoreach_deploy

# Copy the PUBLIC key to the VPS
ssh-copy-id -i ~/.ssh/autoreach_deploy.pub root@54.37.159.215

# Copy the PRIVATE key content into the VPS_SSH_KEY GitHub secret
cat ~/.ssh/autoreach_deploy
```

---

## Step 15 — Configure OAuth Callback URLs

> ⚙️ Do this in the OAuth provider dashboards before testing login.

**GitHub OAuth App** (`github.com/settings/developers` → OAuth Apps):
```
Homepage URL:    https://leads.creativecomet.tn
Callback URL:    https://leads.creativecomet.tn/api/auth/callback/github
```

**Google OAuth** (`console.cloud.google.com` → APIs & Services → Credentials):
```
Authorized redirect URI: https://leads.creativecomet.tn/api/auth/callback/google
```

---

## Step 16 — Configure Resend Webhook

> ⚙️ In the Resend dashboard → Webhooks → Add Endpoint

```
URL:    https://leads.creativecomet.tn/api/webhooks/resend
Events: email.bounced, email.complained
```

Copy the signing secret and add it to your VPS `.env` as `RESEND_WEBHOOK_SECRET`, then restart the API:

```bash
docker compose restart api
```

---

## Step 17 — Full End-to-End Smoke Test

Run this checklist manually after everything is live:

```
[ ] Open https://leads.creativecomet.tn — dashboard loads, HTTPS padlock visible
[ ] Sign in with GitHub or Google — redirected to /dashboard
[ ] Settings page — save a Groq + Resend API key
[ ] Leads page — empty state shown correctly
[ ] Download page (/download) — shows download buttons (after first worker release)
[ ] Connect worker (/connect-worker) — opens autoreach-worker:// protocol link
[ ] Open desktop app — loads https://leads.creativecomet.tn in the window
[ ] Start a scrape from the tray popup — leads appear in real-time in the browser tab
[ ] Send an outreach email — arrives in inbox, unsubscribe link works
[ ] Check CI: push a commit to main — GitHub Actions deploys automatically
```

---

## Ongoing Operations

### Deploy manually (any time):
```bash
ssh root@54.37.159.215 "bash /var/www/autoreach/deploy.sh"
```

### View live logs:
```bash
# API logs
docker compose -f /var/www/autoreach/docker-compose.yml logs -f api

# Dashboard logs
docker compose -f /var/www/autoreach/docker-compose.yml logs -f dashboard
```

### Release a new desktop worker:
```bash
# 🖥️ On your local machine — push a version tag
git tag v2.0.1
git push origin v2.0.1
# GitHub Actions builds Win/Mac/Linux, uploads to VPS, writes manifest.json
```

### Reset a stuck migration:
```bash
docker compose exec api npx prisma migrate status
docker compose exec api npx prisma migrate deploy
```

### Backup the database:
```bash
docker compose exec postgres pg_dump -U autoreach autoreach > backup_$(date +%Y%m%d).sql
```
