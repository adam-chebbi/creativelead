# AutoReach V2 — Complete Implementation Walkthrough

## Phases 3–5: Core Backend (Auth, Security, Real-time)

### 1. NextAuth & Prisma Integration (Phase 3)
- Replaced the custom auth flow with `@auth/prisma-adapter`.
- [options.ts](file:///c:/Users/ADAM/Desktop/autoreach/dashboard/app/api/auth/[...nextauth]/options.ts) links NextAuth to the Prisma DB, with a custom JWT callback that injects a signed `accessToken` for API bridge usage.

### 2. Encryption for API Keys (Phase 4)
- Created [api/src/lib/encryption.ts](file:///c:/Users/ADAM/Desktop/autoreach/api/src/lib/encryption.ts) — AES-256-GCM. Zero plain-text key storage.
- Settings route encrypts `resendApiKey`, `groqApiKey`, `googleMapsApiKey` before persisting. Dashboard receives masked versions (`...f1A8`).

### 3. Real-time Native Streaming / SSE (Phase 5)
- Built [api/src/routes/dashboard/stream.ts](file:///c:/Users/ADAM/Desktop/autoreach/api/src/routes/dashboard/stream.ts) — a native `text/event-stream` endpoint using an in-process `Map<userId, Set<Response>>`.
- Removed all `@supabase/supabase-js` dependencies. Frontend [useLeads.ts](file:///c:/Users/ADAM/Desktop/autoreach/dashboard/hooks/useLeads.ts) uses native `EventSource`.

---

## Phases 6–7: Desktop Application

### 4. Desktop Worker Auth Pairing (Phase 6)
- Created [dashboard/app/connect-worker/page.tsx](file:///c:/Users/ADAM/Desktop/autoreach/dashboard/app/connect-worker/page.tsx) — provisions a one-time 32-byte token, stores SHA-256 hash in `WorkerSession`, redirects browser to `autoreach-worker://auth?token=<token>`.

### 5. Electron Web-Shell Transition (Phase 7)
- [worker/src/main/index.ts](file:///c:/Users/ADAM/Desktop/autoreach/worker/src/main/index.ts) now:
  - Registers `autoreach-worker://` as a system protocol.
  - Handles `second-instance` (Win/Linux) and `open-url` (macOS) events.
  - Loads `https://leads.creativecomet.tn` as the main window — the desktop IS the web app.
- [worker/src/main/api/client.ts](file:///c:/Users/ADAM/Desktop/autoreach/worker/src/main/api/client.ts) injects `X-Worker-Token` on every request.

---

## Phase 8: Cron & Webhooks

### 6. Atomic Follow-up Cron
- [api/src/jobs/followupCron.ts](file:///c:/Users/ADAM/Desktop/autoreach/api/src/jobs/followupCron.ts) uses `$queryRaw UPDATE ... RETURNING id` to atomically claim follow-ups, preventing duplicate sends on server restart.
- Startup hook in [api/src/index.ts](file:///c:/Users/ADAM/Desktop/autoreach/api/src/index.ts) resets any `'processing'` rows back to `'pending'` on boot.

### 7. Resend Webhook Handler
- [api/src/routes/webhooks/resend.ts](file:///c:/Users/ADAM/Desktop/autoreach/api/src/routes/webhooks/resend.ts) validates Resend webhook signatures with `svix`, handles `email.bounced`, `email.complained`, `email.replied` — automatically advances lead stage and cancels pending follow-ups.

---

## Phases 9–10: CI/CD & Production Deployment

### 8. Docker Stack (Phase 9)
- [docker-compose.yml](file:///c:/Users/ADAM/Desktop/autoreach/docker-compose.yml) — 4-service production stack:
  - **postgres** (16-alpine) — internal only, persisted volume.
  - **api** — Node/Express on port 3070 (internal).
  - **dashboard** — Next.js standalone on port 3040 (internal).
  - **nginx** — sole public entry point on 80/443.

### 9. Nginx Config (Phase 9)
- [nginx/autoreach.conf](file:///c:/Users/ADAM/Desktop/autoreach/nginx/autoreach.conf) — SSL, HTTP→HTTPS redirect, SSE-specific no-buffering block at `/api/dashboard/stream`, API proxy, static downloads, and dashboard catch-all.

### 10. API Dockerfile (Phase 9)
- [api/Dockerfile](file:///c:/Users/ADAM/Desktop/autoreach/api/Dockerfile) — multi-stage build. Container auto-runs `prisma migrate deploy` on startup before accepting traffic.

### 11. Deploy Script (Phase 9)
- [deploy.sh](file:///c:/Users/ADAM/Desktop/autoreach/deploy.sh) — pulls code, rebuilds only `api` + `dashboard` (postgres/nginx stay running), waits 8s, runs migrations, then health-checks both services and exits non-zero on failure.

### 12. CI/CD Pipelines (Phase 9)
- [dashboard-ci.yml](file:///c:/Users/ADAM/Desktop/autoreach/.github/workflows/dashboard-ci.yml) — Vercel replaced with `appleboy/ssh-action` calling `deploy.sh`.
- [api-ci.yml](file:///c:/Users/ADAM/Desktop/autoreach/.github/workflows/api-ci.yml) — Railway replaced with same SSH deploy pattern.
- [worker-release.yml](file:///c:/Users/ADAM/Desktop/autoreach/.github/workflows/worker-release.yml) — `API_BASE_URL` corrected to `leads.creativecomet.tn/api`, `WORKER_SECRET` injected at build, SCP step uploads installers, SSH step writes `manifest.json`.

### 13. Environment Variables (Phase 9)
- [.env.example](file:///c:/Users/ADAM/Desktop/autoreach/.env.example) — complete reference for all 15+ production vars with generation commands.

---

## Phase 10: VPS Bootstrap Checklist

To go live on `54.37.159.215`, run these steps **once** on the server:

```bash
# 1. Clone repo
git clone <repo> /var/www/autoreach && cd /var/www/autoreach

# 2. Create .env from example (fill in real values)
cp .env.example .env && nano .env

# 3. Create download directory
mkdir -p public/downloads

# 4. Start postgres + nginx first
docker compose up -d postgres nginx

# 5. Obtain SSL cert (one-time)
docker run --rm -v ./certbot/conf:/etc/letsencrypt \
  -v ./certbot/www:/var/www/certbot \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot -d leads.creativecomet.tn \
  --email admin@creativecomet.tn --agree-tos --no-eff-email

# 6. Reload nginx with SSL
docker compose exec nginx nginx -s reload

# 7. Start full stack
docker compose up -d

# 8. Verify
curl https://leads.creativecomet.tn/api/health
```

**GitHub Actions Secrets to set:**
| Secret | Value |
|--------|-------|
| `VPS_HOST` | `54.37.159.215` |
| `VPS_USER` | `root` (or deploy user) |
| `VPS_SSH_KEY` | Private SSH key for VPS |
| `WORKER_SECRET` | Same as `.env` `WORKER_SECRET` |

**SSL Auto-renewal cron** (add to server crontab):
```
0 12 * * * certbot renew --quiet && docker compose -f /var/www/autoreach/docker-compose.yml exec nginx nginx -s reload
```
