# AutoReach — Production Blueprint
### Target: `leads.creativecomet.tn` (VPS)
### Architecture Principle: Web = Desktop. One codebase, one data layer, scraping runs on the user's machine.

---

## 1. The Big Picture — What You're Actually Building

AutoReach is a **Figma-model SaaS**. You use the web version at `leads.creativecomet.tn` and it is identical to the desktop app in every way — same pages, same data, same UI — except the desktop app can run the Playwright/Chromium scraper locally on the user's machine. Everything syncs in real time to the same backend. Users who don't need local scraping never need to install anything.

**The Three-Layer Stack:**

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1 — Dashboard  (Next.js, port 3040)          │
│  Served at leads.creativecomet.tn via Nginx          │
│  Identical UI whether opened in browser or Electron  │
└──────────────────────┬──────────────────────────────┘
                       │  REST + SSE
┌──────────────────────▼──────────────────────────────┐
│  LAYER 2 — API Bridge  (Node/Express, port 3070)     │
│  Auth, data reads/writes, follow-up cron, email send │
│  Talks to PostgreSQL (local Docker container)        │
└──────────────────────┬──────────────────────────────┘
                       │  Worker API (JWT + Worker Secret)
┌──────────────────────▼──────────────────────────────┐
│  LAYER 3 — Desktop Worker  (Electron + Playwright)   │
│  Runs on user's machine                              │
│  Scrapes Google Maps + websites, pushes leads to API │
└─────────────────────────────────────────────────────┘
```

---

## 2. Current State Audit — What Is Broken and Why

### 2.1 Identity Crisis — Three Incompatible Backends Exist Simultaneously

The codebase contains **three completely different backend implementations** that are not connected:

- `app.py` — The original Flask/Python monolith with SQLite/Turso. Still has scraping, emailing, all routes.
- `api/src/index.ts` — A new Node/Express API bridge with Prisma + PostgreSQL. The "V2" backend.
- `autoreach_core/` — A Python CLI core with its own SQLite database, its own emailer, its own scraper.

**None of these share the same database.** The desktop worker connects to `api.autoreach.dev` (an external domain) instead of your VPS. The dashboard connects to neither `app.py` nor the CLI.

**Fix:** Retire `app.py` as the web server. The Node API (`api/`) becomes the single backend. All clients — web, desktop, mobile — talk only to the Node API.

### 2.2 The Desktop Worker Points to the Wrong Server

In `worker-release.yml` the build environment sets `API_BASE_URL: https://api.autoreach.dev`. Every released desktop app built from this CI talks to someone else's server.

**Fix:** Change to `https://leads.creativecomet.tn/api` in the CI secrets and Electron build config.

### 2.3 Real-Time Sync Is Not Implemented

`ScrapingState.tsx` listens to Electron IPC events. But there is **no WebSocket or SSE channel** from the API to the web dashboard. If you open the web app while the desktop is scraping, the web app does not update — you have to manually refresh leads.

**Fix:** Add a Server-Sent Events (SSE) channel on the API. The desktop worker pushes each lead to the API; the API broadcasts that lead via SSE to any open web dashboard tabs for the same user. This is how Figma does it.

### 2.4 Auth Is Split and Inconsistent

- `app.py` uses Flask sessions + a single `WEB_PASSWORD` — no per-user accounts.
- `auth.py` (Flask) implements GitHub, Discord, Google OAuth and JWT for the Flutter mobile app.
- `dashboard/` uses NextAuth with `@auth/prisma-adapter` connecting to Supabase.
- `api/src/` has its own JWT middleware with `jsonwebtoken`.

A user who signs in with Google on the web dashboard is a **different user identity** from a user who authenticates with a JWT in the desktop worker. There is no single source of truth.

**Fix:** NextAuth on the dashboard issues JWTs. Those JWTs are the only auth token in the system. The API validates them. The desktop worker stores one JWT and sends it with every API call. All Flask auth is retired.

### 2.5 The Database Schema Is Duplicated and Diverged

Flask operates on a `businesses` table. The Node API uses a `Business` Prisma model. The CLI uses a `leads` table. All three have different column names for the same concept. Stage values differ. Follow-up tables have different structures.

**Fix:** One canonical Prisma schema. All data access goes through Prisma. The CLI is archived.

### 2.6 The Email Sending Architecture Leaks API Keys

`/api/send-email` in Flask accepts a `resend_api_key` from the client in the request body. The user's Resend API key is sent to your server on every email send and can appear in server logs. If the VPS is ever compromised, every user's Resend key is exposed.

**Fix:** The Resend API key is stored encrypted in the user's settings row on the server using AES-256-GCM with a server-side `ENCRYPTION_KEY`. The client never sends the key in email requests. The server decrypts and uses it.

### 2.7 The Docker Compose Has No Reverse Proxy and No HTTPS

The `docker-compose.yml` exposes ports 3040 and 3070 bound to `127.0.0.1`. There is no Nginx container, no SSL termination, no Certbot. The deploy script runs `docker-compose up` but never sets up the Nginx vhost or certificates.

**Fix:** Add an Nginx container that terminates SSL and proxies routes to the correct service. Certbot obtains the certificate once and auto-renews via cron.

### 2.8 Supabase Is an Unnecessary External Dependency

The dashboard and API both import `@supabase/supabase-js`. But you have a VPS — Supabase is only being used as a managed Postgres host. This adds cost and an external point of failure.

**Fix:** Run PostgreSQL directly in Docker on the VPS. Remove Supabase entirely. Prisma connects to the local container.

### 2.9 The Follow-up Cron Has No Idempotency Guard

`followupCron.ts` runs every hour and processes pending follow-ups. If the server restarts mid-batch, follow-ups can be sent twice. There is no lock or atomic status transition.

**Fix:** Use an atomic `UPDATE ... SET status = 'processing' WHERE status = 'pending' RETURNING id` to claim rows. Only process rows you own. Reset `processing` rows to `pending` on startup if they are older than 10 minutes.

### 2.10 The CORS Config Is Too Permissive

`app.py` allows any origin. The Node API skips the origin check entirely for requests with no `Origin` header, meaning any server-to-server request can hit the API unauthenticated.

**Fix:** All `/api/worker/*` routes require both a valid user JWT and a `X-Worker-Token` header (a shared secret bundled into Electron at build time and stored in `.env` as `WORKER_SECRET`).

---

## 3. The Production Architecture

### 3.1 Server Layout (leads.creativecomet.tn)

```
/var/www/autoreach/
├── docker-compose.yml
├── .env                      ← server secrets, never committed
├── nginx/
│   └── autoreach.conf
├── certbot/                  ← SSL certs, auto-renewed
├── postgres-data/            ← PostgreSQL data volume
├── public/
│   └── downloads/            ← Electron installer binaries (.exe, .dmg, .AppImage)
├── dashboard/
└── api/
```

### 3.2 Docker Compose Services (Four Containers, One Network)

**postgres** — PostgreSQL 16 Alpine. Data persisted to `./postgres-data`. Not exposed externally. Only accessible within the Docker network on `postgres:5432`.

**api** — Node/Express. Connects to `postgres` container via internal Docker DNS. Runs Prisma migrations on startup. Exposes port 3070 internally only.

**dashboard** — Next.js standalone build. Connects to the api container at `http://api:3070`. Exposes port 3040 internally only.

**nginx** — Nginx Alpine. The only container with external ports (80 and 443). Terminates SSL. Proxies `/api/*` to the api container and all other traffic to the dashboard container.

### 3.3 Nginx Routing Rules

```
leads.creativecomet.tn/               → dashboard:3040
leads.creativecomet.tn/api/           → api:3070
leads.creativecomet.tn/api/dashboard/stream → SSE (no buffering, 3600s timeout)
leads.creativecomet.tn/downloads/     → static files from /var/www/autoreach/public/downloads/
```

Three directives are mandatory on the SSE location or it will not work through Nginx:
`proxy_buffering off`, `proxy_cache off`, `add_header X-Accel-Buffering no`.

### 3.4 Single Database Schema (Prisma)

**User** — id, email, name, avatar, provider, providerAccountId, createdAt. Relations: Settings (one), Businesses (many), SentLogs (many), FollowupLogs (many), ScrapeJobs (many), WorkerSessions (many).

**Settings** — userId (unique FK), groqApiKeyEncrypted, resendApiKeyEncrypted, resendFromEmail, senderName, followupStep3Enabled, followupStep7Enabled, followupStep14Enabled, emailTemplateId, googleMapsApiKeyEncrypted.

**Business** — id, userId (FK), name, address, city, phone, website, email, stage (enum: New/Contacted/Replied/Closed/Unsubscribed), notes, rating, reviewCount, openingHours (JSON), attributes (String array), unsubscribed (Boolean), scrapeJobId (FK nullable), placeId (unique per user), createdAt, updatedAt.

**Review** — id, businessId (FK), authorName, rating, text, publishedAt.

**SentLog** — id, userId (FK), businessId (FK), businessName, toEmail, subject, body, language, status (sent/failed), templateId, senderEmail, sentAt.

**FollowupLog** — id, userId (FK), businessId (FK), businessName, toEmail, followupStep (1/2/3), status (pending/processing/sent/skipped/replied), scheduledFor (DateTime), subject, body, language, sentAt.

**ScrapeJob** — id, userId (FK), city, businessType, maxResults, scrapeReviews, status (queued/running/paused/completed/cancelled), leadsCollected, leadsTotal, createdAt, updatedAt.

**WorkerSession** — id, userId (FK), tokenHash (the `WORKER_SECRET` HMAC'd with the user's id), lastSeenAt, createdAt.

### 3.5 Authentication Flow

NextAuth is the single auth entry point. It supports GitHub, Google, and email/password credentials. On sign-in, NextAuth upserts a `User` row via Prisma adapter.

NextAuth sessions contain the user's `id`. Server components and server-side API routes call `getServerSession()`. Client components and the API bridge receive a signed JWT from NextAuth.

The Electron worker stores one JWT after the pairing flow. Every worker API call includes `Authorization: Bearer <jwt>` and `X-Worker-Token: <WORKER_SECRET>`. The API bridge validates both.

**Desktop pairing flow:**
1. User opens the desktop app for the first time.
2. App opens `leads.creativecomet.tn/connect-worker` in the system browser.
3. User authenticates with NextAuth normally.
4. Server generates a `WorkerSession` row, hashes the session token, redirects to `autoreach-worker://auth?token=<token>`.
5. Electron's `protocol.handle('autoreach-worker')` intercepts this URL.
6. The app stores the token. Future requests use it as the Bearer token.

---

## 4. The Sync Model — Desktop ↔ Web (The Figma Model)

### 4.1 What Runs Where

| Action | Where it runs | How it syncs |
|---|---|---|
| Google Maps scraping | Desktop worker (Playwright) | Worker POSTs each lead to API as found |
| Website email extraction | Desktop worker | Worker PATCHes lead with email |
| Review scraping | Desktop worker | Worker POSTs reviews to API |
| Email sending | API server | Triggered from web or desktop, uses stored key |
| Follow-up scheduling | API server (cron) | Fully automatic |
| Viewing leads / pipeline | Web or Desktop (same Next.js) | API reads from DB |
| Stage changes | Web or Desktop | API writes to DB, SSE broadcasts change |
| Settings | Web or Desktop | API writes encrypted values to DB |

### 4.2 Real-Time Lead Sync (SSE)

When the desktop worker finds a lead, it POSTs to `POST /api/worker/lead`. The API saves to DB and immediately publishes an SSE event on `GET /api/dashboard/stream` to all open connections for that user.

The API uses a module-scoped `Map<userId, Set<Response>>` to track open SSE connections. No Redis, no external pub/sub required for a single VPS instance. When a connection closes, remove it from the set. When a new lead arrives, iterate the set and write an event to each connection.

The web dashboard subscribes on mount via `EventSource`. The Electron main window loads `leads.creativecomet.tn` directly (a `BrowserWindow` pointing to your VPS URL) so it receives SSE automatically.

### 4.3 The Desktop App Is the Web Dashboard in an Electron Shell

This is the key architectural decision. The Electron main window calls `win.loadURL('https://leads.creativecomet.tn')`. The main window **is** the web app — not a bundled React build.

What Electron adds on top:
- The `window.autoreach` preload bridge (injected into the loaded web page) for scraping controls.
- The `autoreach-worker://` protocol handler for auth pairing.
- A system tray icon and native menus.
- The ability to launch and control headless Chromium via Playwright.
- A separate small tray popup `BrowserWindow` for `IdleState` / `ScrapingState` panels — this can remain bundled since it is tray-specific and small.

**Consequence:** When you deploy new UI code to the VPS, all desktop users get the update automatically on next open. You only release a new desktop installer when the Electron `main.ts` or Playwright scraper code changes. The web and desktop are always in sync by construction.

---

## 5. File-by-File Changes Required

### 5.1 Retire (Delete or Archive)

- `app.py` — Flask monolith. Replaced by Node API + Next.js.
- `templates/` — Jinja2 HTML. Replaced by Next.js pages.
- `auth.py` (Flask) — Replaced by NextAuth.
- `followup.py` (Flask) — Replaced by `api/src/jobs/followupCron.ts`.
- `emailer.py` (root) — Replaced by Node API email route.
- `lead_finder.py` — Replaced by Electron Playwright scraper.
- `email_scraper.py` — Replaced by Electron email crawler.
- `autoreach_core/` — CLI code. Archive separately if needed.
- `cli/` — Archive separately.
- `render.yaml` — Not deploying to Render.
- `worker/src/renderer/` (the full bundled React app) — The main window now loads the VPS URL. Only the tray popup components remain as bundled React.

### 5.2 api/ — Changes Required

**What exists and works:** Express server structure, Prisma setup, rate limiting, error handling, follow-up cron skeleton, dashboard and worker route files, JWT middleware.

**What must be added or fixed:**

`POST /api/worker/lead` — After saving to DB, emit SSE event to all open connections for this user. This route does not yet fire SSE.

`GET /api/dashboard/stream` — This endpoint does not exist yet. Create it. It sets headers `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, then holds the connection open. Register the response in the SSE map for the user. On client disconnect, remove it.

`POST /api/dashboard/send-email` — Currently expects the Resend key in the request body. Change to: read `resendApiKeyEncrypted` from the user's Settings row, decrypt with `ENCRYPTION_KEY`, use the decrypted key to call Resend. Never accept the key in the request.

`POST /api/dashboard/settings` — Accept settings including API keys. Encrypt keys before saving with AES-256-GCM using `ENCRYPTION_KEY`. Return decrypted values only in the settings GET (for display in the UI), never log them.

`POST /api/worker/scrape/jobs` — Create a `ScrapeJob` row with `status: 'running'`. Return the job ID to the worker.

`PATCH /api/worker/scrape/jobs/:jobId` — Update status, leadsCollected, leadsTotal.

`POST /api/worker/heartbeat` — Update `WorkerSession.lastSeenAt` for the authenticated user.

`POST /api/worker/lead/:leadId/reviews` — Bulk insert reviews for a business.

`PATCH /api/worker/lead/:leadId/email` — Update the email field on a business.

`GET /api/worker/status` — Return whether this user's worker session is active and last seen. Used by the web dashboard to show "Worker online/offline."

`GET /unsubscribe` — Public route (no auth). Port the unsubscribe logic from `app.py` exactly. Sets `unsubscribed = true` and `stage = 'Unsubscribed'` on the Business row. Renders a simple HTML response (or redirects to a Next.js page).

`POST /api/webhooks/resend` — Resend webhook for reply detection. Validates the Resend webhook signature. When a `reply` event arrives, find the Business by email, set stage to `Replied`, cancel pending FollowupLog rows for that business.

The `followupCron.ts` — Add the idempotency guard described in Section 2.9. Add Arabic language support to `generateFollowup()`.

Remove `@supabase/supabase-js` from `package.json`. All realtime is handled via the in-process SSE map.

Change `API_BASE_URL` references in all CI workflows and Electron code from `api.autoreach.dev` to `leads.creativecomet.tn/api`.

### 5.3 dashboard/ — Changes Required

**What exists and works:** App router structure, TanStack Query, Radix UI, teal/coral dark theme, lead detail page, outreach page, settings page, pipeline view, download page route, middleware protecting `/dashboard` and `/download`.

**What must be added or fixed:**

Remove `@supabase/supabase-js` from `package.json`. Replace any Supabase realtime usage with the SSE `EventSource` client. Create a `useLeadStream()` hook that connects to `/api/dashboard/stream` and appends incoming leads to the TanStack Query cache.

NextAuth config (`app/api/auth/[...nextauth]/route.ts`) must set `NEXTAUTH_URL=https://leads.creativecomet.tn`. OAuth callback URLs must match. The adapter must use the shared Prisma instance (same `DATABASE_URL` as the API — both containers connect to the same Postgres, and since they are separate Node processes, each gets its own Prisma connection pool).

`/dashboard/scrape` page — The current `IdleState` / `ScrapingState` panels from the Electron worker have equivalent web versions needed here. If no worker is connected, show a "Download the desktop app to enable scraping" message with a link to `/download`. If a worker is connected (check `/api/worker/status`), show the scrape controls (city, business type, max results, start button). Progress updates come via SSE.

`/connect-worker` page — This page is the landing point after the user clicks the pairing link in the desktop app. It must be a server component that calls `getServerSession()`, generates a `WorkerSession` token, saves the hashed token to DB, and redirects to `autoreach-worker://auth?token=<token>`. The page shown before the redirect should say "Connecting your desktop app..."

`/download` page — Fetch available installer versions from a static manifest file at `/var/www/autoreach/public/downloads/manifest.json` (written by the worker CI after each release). Show download buttons for Windows, macOS, Linux. Show the pairing instructions.

Settings page — Fields for Groq API key, Resend API key, From email, Sender name, Google Maps API key. Show saved values masked (show last 4 characters). On save, POST to `/api/dashboard/settings`. The server encrypts before storing.

Remove all environment variable references to Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Add `NEXT_PUBLIC_API_URL=https://leads.creativecomet.tn/api`.

### 5.4 worker/ — Changes Required

**What exists and works:** Electron shell, IPC bridge, `window.autoreach` preload, `IdleState` / `ScrapingState` / `LiveFeed` components, Playwright integration skeleton, CI for Win/Mac/Linux builds.

**What must change:**

The main `BrowserWindow` must call `win.loadURL('https://leads.creativecomet.tn')` instead of loading a bundled HTML file. The preload script (`preload.ts`) must inject `window.autoreach` into the loaded page using `contextBridge.exposeInMainWorld`. This is already the pattern in the existing preload — it just needs the URL changed.

The tray popup (the small panel showing `IdleState` / `ScrapingState`) keeps its bundled React build. This is a separate `BrowserWindow` that is narrow and frameless. It calls `win.loadFile(...)` for the bundled tray HTML. Only this window is bundled.

Register `autoreach-worker://` as a custom protocol in `main.ts` using `protocol.handle`. When Electron intercepts a URL matching this scheme, extract the token from query params and store it securely using `safeStorage.encryptString` (Electron's built-in OS keychain wrapper). On subsequent launches, read the token with `safeStorage.decryptString`.

All worker API calls must include `Authorization: Bearer <stored-jwt>` and `X-Worker-Token: <WORKER_SECRET>`. The `WORKER_SECRET` is injected at build time via the `define` option in `electron-builder` config (it reads the value from a CI secret).

`API_BASE_URL` is changed to `https://leads.creativecomet.tn/api` in the Electron build config and in `worker-release.yml`.

The Playwright scraper in `main.ts` must POST to `POST /api/worker/scrape/jobs` at start, POST each lead to `POST /api/worker/lead` as found, PATCH with email when discovered, POST reviews when collected, and PATCH the job status on completion or cancellation.

### 5.5 docker-compose.yml — Full Replacement

The current file must be completely replaced with one that defines postgres, api, dashboard, and nginx services as described in Section 3.2. Key details:

All services share a single `autoreach_net` bridge network. Postgres is on the network with hostname `postgres`. The api service environment includes `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`. Both api and dashboard read shared secrets (`NEXTAUTH_SECRET`) from the root `.env` file. Nginx mounts `./nginx/autoreach.conf`, `./certbot/conf`, and `./certbot/www`. Nginx depends on api and dashboard. Restart policy is `unless-stopped` for all services.

### 5.6 nginx/autoreach.conf

Server block for port 80: only serves the Certbot ACME challenge path (`/.well-known/acme-challenge/`), redirects everything else to HTTPS.

Server block for port 443: SSL cert from Certbot. `proxy_set_header Host $host`, `proxy_set_header X-Real-IP $remote_addr`, `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`, `proxy_set_header X-Forwarded-Proto $scheme`.

Location `/api/dashboard/stream`: `proxy_buffering off`, `proxy_cache off`, `add_header X-Accel-Buffering no`, `proxy_read_timeout 3600s`, `proxy_pass http://api:3070`.

Location `/api/`: `proxy_pass http://api:3070`, `proxy_http_version 1.1`, `proxy_set_header Connection ""`.

Location `/downloads/`: `alias /var/www/autoreach/public/downloads/`, `autoindex off`.

Location `/`: `proxy_pass http://dashboard:3040`.

`client_max_body_size 20m` for CSV imports.

### 5.7 deploy.sh — Full Replacement

The new deploy script:

1. `cd /var/www/autoreach && git pull origin main`
2. `docker-compose build --no-cache api dashboard` (skip postgres and nginx)
3. `docker-compose up -d --no-deps api dashboard` (recreate only changed containers, leave postgres and nginx running)
4. Wait 5 seconds for Node to start
5. `docker-compose exec api npx prisma migrate deploy` (apply any new DB migrations)
6. `curl -sf https://leads.creativecomet.tn/api/health && echo "API OK" || echo "API FAILED"`
7. `curl -sf https://leads.creativecomet.tn && echo "Dashboard OK" || echo "Dashboard FAILED"`

SSL renewal is a separate cron job running as root: `0 12 * * * certbot renew --quiet && docker-compose -f /var/www/autoreach/docker-compose.yml exec nginx nginx -s reload`.

---

## 6. The Electron Scraping Flow in Detail

When the user clicks "Start Scraping" in the tray popup:

1. Renderer calls `window.autoreach.startScraping({ city, businessType, maxResults, scrapeReviews })`.
2. Preload forwards to `main.ts` via `ipcMain.handle('scrape:start')`.
3. `main.ts` calls `POST /api/worker/scrape/jobs`. API creates `ScrapeJob` row with `status: 'running'`, returns `jobId`.
4. `main.ts` launches Playwright Chromium headless. Navigates Google Maps search.
5. For each business found:
   - Sends `ipcRenderer.send('scrape:lead-found', leadData)` to update the tray UI progress.
   - POSTs to `POST /api/worker/lead` with `{ ...leadData, jobId }`.
   - API saves the Business row and fires an SSE event to the user's open web dashboard tabs.
6. If `scrapeReviews` is true: after extracting business data, Playwright fetches reviews. POSTs to `POST /api/worker/lead/:leadId/reviews`.
7. For email scraping: lightweight HTTP crawl of the business website checking homepage, `/contact`, `/contact-us`, `/about`. Found email is PATCHed to `PATCH /api/worker/lead/:leadId/email`. API fires another SSE event with the updated lead.
8. On completion: `PATCH /api/worker/scrape/jobs/:jobId` with `status: 'completed'`. API sends SSE job completion event.
9. `main.ts` sends `ipcRenderer.send('scrape:complete', { collected, synced })` to update the tray UI.

**CAPTCHA handling:** Playwright watches for known CAPTCHA selectors or the URL changing to a verification page. On detection: `main.ts` sends `ipcRenderer.send('scrape:captcha')`. Tray UI shows the CAPTCHA alert card. User clicks "Resume" → preload calls `ipcMain.handle('scrape:resume')` → `main.ts` shows the Playwright browser window with `win.show()`. User solves CAPTCHA. Playwright watches for URL change back to Maps. On success: `main.ts` hides the browser window and continues the loop.

**Pause/Resume:** Playwright can be paused by setting a module-level `isPaused` flag in `main.ts` and checking it in the scraping loop with a `while(isPaused) await sleep(500)` guard.

---

## 7. Features That Must Be Built From Scratch

### 7.1 Encrypted Settings Storage

Before any settings routes are written for the Node API, create an `encryption.ts` utility using Node's built-in `crypto` module with AES-256-GCM. `encrypt(plaintext, key)` returns `{ iv, ciphertext, authTag }` joined as a base64 string. `decrypt(ciphertext, key)` reverses it. The `ENCRYPTION_KEY` env var is the 32-byte hex key. `groqApiKeyEncrypted`, `resendApiKeyEncrypted`, `googleMapsApiKeyEncrypted` in the Settings model store the encrypted ciphertext. On every use, the API decrypts in memory and never logs the plaintext.

### 7.2 Worker Health Beacon

The desktop worker pings `POST /api/worker/heartbeat` every 60 seconds while the app is open. This updates `WorkerSession.lastSeenAt`. The dashboard's scrape page and the `/download` page check `GET /api/worker/status` and show "Worker online" or "Worker offline — last seen X minutes ago."

### 7.3 Reply Detection via Resend Webhook

The CLI's `check_for_replies` function checked IMAP. The Node API equivalent uses Resend webhooks instead. Configure a Resend webhook pointing to `POST /api/webhooks/resend`. Resend signs webhook payloads — validate the `Resend-Signature` header using the webhook signing secret from `.env`. When a `email.bounced`, `email.complained`, or a custom reply event arrives, find the Business row by the recipient email, update stage, cancel pending follow-ups.

### 7.4 The /download Page with Release Manifest

The worker CI (after a successful build and GitHub Release) copies the installer files to `/var/www/autoreach/public/downloads/` on the VPS via SCP and writes a `manifest.json` file: `{ "version": "1.2.3", "windows": "/downloads/AutoReach-1.2.3.exe", "macos": "/downloads/AutoReach-1.2.3.dmg", "linux": "/downloads/AutoReach-1.2.3.AppImage", "releasedAt": "2026-06-20T..." }`. The `/download` Next.js page fetches this manifest at request time and shows the correct download links.

### 7.5 Arabic Email Generation

The dashboard outreach page already shows Arabic in the language dropdown. The Node API's email generation function needs a third language case. The Arabic prompt follows the same structure as English: address the business by name, write as a person, sign off with the sender name, under 120 words, return only the body. Test with `llama-3.1-8b-instant` which handles Arabic well. The subject line template for Arabic uses right-to-left text.

### 7.6 ARIA Chatbot on Node API

The ARIA chatbot in `app.py` is implemented as `POST /api/aria`. Port this route to the Node API as `POST /api/dashboard/aria`. Fetch the user's `groqApiKeyEncrypted` from Settings, decrypt it, use it to call Groq. The jailbreak keyword filter, the language detection, and the system prompt all port directly. The security rules and identity rules in the system prompt should be kept verbatim.

---

## 8. CI/CD — What Changes

### 8.1 dashboard-ci.yml

Remove the Vercel deployment step entirely. Replace with:

```yaml
- name: Deploy to VPS
  uses: appleboy/ssh-action@v1.0.3
  with:
    host: ${{ secrets.VPS_HOST }}
    username: ${{ secrets.VPS_USER }}
    key: ${{ secrets.VPS_SSH_KEY }}
    script: bash /var/www/autoreach/deploy.sh
```

TypeCheck and build steps remain for CI validation.

### 8.2 api-ci.yml

Same pattern: replace the Railway deploy step with the SSH action calling `deploy.sh`.

### 8.3 worker-release.yml

Keep the three build jobs (Windows, macOS, Linux). Make these changes:

- Add `API_BASE_URL: https://leads.creativecomet.tn/api` to all three build env sections.
- Add `WORKER_SECRET: ${{ secrets.WORKER_SECRET }}` to all three build env sections.
- After the GitHub Release creation step, add an SCP step that uploads the built installers to `/var/www/autoreach/public/downloads/` on the VPS.
- Add a step that writes `manifest.json` to the VPS with the new version and download paths.

---

## 9. Implementation Order

### Phase 1 — VPS Foundation
Point `leads.creativecomet.tn` DNS A record to the VPS IP. Install Docker and Docker Compose on the VPS. Clone the repo to `/var/www/autoreach`. Create the `.env` file with all secrets. Write the Nginx config. Run Certbot once to obtain the SSL certificate. Start only the postgres container and verify it accepts connections.

### Phase 2 — Database
Write the complete Prisma schema. Run `prisma migrate dev` locally to generate the migration. Commit the migration file. Start the api container with postgres. Verify `https://leads.creativecomet.tn/api/health` returns 200.

### Phase 3 — Auth
Configure NextAuth providers (GitHub, Google, credentials). Set up OAuth apps with the correct callback URLs pointing to `leads.creativecomet.tn`. Verify sign-in works end-to-end. Verify the `User` table populates on first login.

### Phase 4 — Core API Routes
Implement all dashboard-facing CRUD: leads, stage updates, settings (with encryption), export CSV, import CSV, outreach send (using stored Resend key), follow-up management, ARIA chatbot. Test each from the dashboard UI.

### Phase 5 — SSE
Implement the SSE endpoint and the in-process SSE map. Test with `curl -N` from the terminal. Then implement the `useLeadStream()` hook in the dashboard and verify events appear in the React UI without a page refresh.

### Phase 6 — Worker Auth Pairing
Implement `/connect-worker` page and `WorkerSession` generation. Register `autoreach-worker://` protocol in Electron. Test the full pairing flow: open the page in a real browser, authenticate, verify the Electron app receives the token.

### Phase 7 — Electron Main Window Switch
Change the Electron main `BrowserWindow` to load `https://leads.creativecomet.tn`. Verify the `window.autoreach` preload bridge injects correctly. Verify the tray popup still works from its bundled build. Test the full scrape → API push → SSE → web dashboard flow locally.

### Phase 8 — Cron and Follow-ups
Implement the idempotent follow-up cron with the atomic status transition. Configure the Resend webhook. Test follow-up scheduling end to end with a manually accelerated due date.

### Phase 9 — CI/CD
Update all three workflow files. Set GitHub Actions secrets. Push to main, verify the deploy completes successfully, and the site is live.

### Phase 10 — Full Production Verification
Run the complete user journey on the live VPS: sign up → connect desktop worker → scrape Google Maps → watch leads appear in the browser in real time via SSE → scrape emails → run outreach campaign → verify follow-up is scheduled → manually mark a lead as Replied → verify follow-up cancels.

---

## 10. What Must Not Change

**The visual design.** Teal `#4ecdc4` and coral `#e8806a` on dark `#0a1414` / `#0d1a1a`. The Radix UI components. The Tailwind setup. The font and spacing. The pipeline stages. The `ScrapingState` progress bar and live feed. All of this is already correct.

**The email templates.** Classic, clean, purple, warm, plain. The HTML in `app.py`'s `_build_email_html` function is production-ready. Port it verbatim as a TypeScript function in `api/src/services/emailTemplates.ts`. Do not redesign the templates.

**The follow-up logic.** Three steps at +3, +7, +14 days. Stops on unsubscribe or reply. Per-step enable/disable toggles in settings. This is correct and just needs to run in the Node cron.

**The ARIA chatbot system prompt.** The jailbreak defenses, the scope restriction, the language detection, the identity rules — all of this is carefully written. Port it verbatim. The only change is that ARIA now uses the server-side decrypted Groq key instead of accepting a key from the client.

**The scraping UI.** `IdleState`, `ScrapingState`, `LiveFeed`, CAPTCHA alert, pause/stop controls. These move to the tray popup BrowserWindow and stay exactly as designed.