# AutoReach — Full Project Audit vs. Blueprint

> Scanned: all files under `c:\Users\ADAM\Desktop\autoreach\` on 2026-06-21
> Reference: [blueprint.md](file:///c:\Users\ADAM\Desktop\autoreach\blueprint.md)

---

## 🟢 Fully Implemented & Aligned

| Area | Status |
|---|---|
| `api/` — Express server structure, helmet, morgan, CORS, rate limiting | ✅ |
| `api/src/lib/encryption.ts` — AES-256-GCM encrypt/decrypt | ✅ |
| `api/src/lib/prisma.ts` — Prisma client singleton | ✅ |
| `api/src/lib/jwt.ts` — JWT verification middleware | ✅ |
| `api/src/routes/dashboard/stream.ts` — SSE endpoint + `clients` map + `emitToUser()` | ✅ |
| `api/src/routes/dashboard/settings.ts` — encrypted API keys, masked GET | ✅ |
| `api/src/routes/dashboard/leads.ts` — CRUD, stage update | ✅ |
| `api/src/routes/dashboard/pipeline.ts` | ✅ |
| `api/src/routes/dashboard/sessions.ts` | ✅ |
| `api/src/routes/dashboard/stats.ts` | ✅ |
| `api/src/routes/worker/leads.ts` | ✅ |
| `api/src/routes/worker/ping.ts` | ✅ |
| `api/src/routes/worker/reviews.ts` | ✅ |
| `api/src/routes/worker/session.ts` | ✅ |
| `api/src/routes/worker/config.ts` | ✅ |
| `api/src/routes/webhooks/resend.ts` — webhook signature validation + reply detection | ✅ |
| `api/src/jobs/followupCron.ts` — **idempotent** atomic `processing` claim, EN/EL/AR | ✅ |
| `api/src/index.ts` — startup resets stuck `processing` follow-ups | ✅ |
| `docker-compose.yml` — 4 containers, `autoreach_net`, postgres internal, nginx exposed | ✅ |
| `nginx/autoreach.conf` | ✅ |
| `deploy.sh` — pull → build → up → migrate → health check | ✅ |
| `worker/src/main/index.ts` — loads `leads.creativecomet.tn` in prod (Figma model) | ✅ |
| `worker/src/main/index.ts` — `autoreach-worker://` protocol handler | ✅ |
| `worker/src/main/index.ts` — 30s heartbeat ping | ✅ |
| `worker/src/main/scraper/` — Playwright scraping engine | ✅ |
| `.github/workflows/worker-release.yml` — correct `API_BASE_URL` + VPS SCP + manifest | ✅ |
| `.github/workflows/dashboard-ci.yml` — SSH deploy (no Vercel) | ✅ |
| `.github/workflows/api-ci.yml` — SSH deploy (no Railway) | ✅ |
| `dashboard/app/connect-worker/page.tsx` — pairing flow page | ✅ |
| `api/prisma/schema.prisma` — all models present | ✅ |

---

## 🔴 Bugs / Schema Mismatches — Will Break the Build or Runtime

### Bug 1 — `SentEmail` model field name mismatch (CRITICAL — build-breaking)

**File:** [`api/src/routes/dashboard/outreach.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\routes\dashboard\outreach.ts) lines 153, 156, 130  
**File:** [`api/src/routes/dashboard/stats.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\routes\dashboard\stats.ts) lines 20, 21  
**File:** [`api/src/jobs/followupCron.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\jobs\followupCron.ts) line 93

**Problem:** The code references `dateSent`, `fromEmail`, and `email` on the `SentEmail` model but the Prisma schema has **`sentAt`**, **`senderEmail`**, and **`toEmail`**.

```diff
# schema.prisma (truth)
  toEmail     String  @map("to_email")
  status      String  @default("sent")
  senderEmail String  @default("") @map("sender_email")
  sentAt      DateTime @default(now()) @map("sent_at")

# code (wrong — will cause Prisma type error at build)
  orderBy: { dateSent: 'desc' },          # ❌ should be sentAt
  select: { ..., dateSent: ..., fromEmail: ... }  # ❌ should be sentAt, senderEmail
  prisma.sentEmail.create({ data: { ..., email: toEmail, fromEmail } })  # ❌ toEmail, senderEmail
  prisma.sentEmail.count({ where: { dateSent: ... } })   # ❌ should be sentAt
```

**Fix required in:** `outreach.ts`, `stats.ts`, `followupCron.ts`

---

### Bug 2 — `outreach.ts` reads non-encrypted field from settings (CRITICAL)

**File:** [`api/src/routes/dashboard/outreach.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\routes\dashboard\outreach.ts) lines 64–65, 110–111

```diff
# outreach.ts /generate — WRONG
const settings = await prisma.userSettings.findUnique({ 
  where: { userId: req.userId }, 
  select: { groqApiKey: true }   # ❌ field does not exist; should be groqApiKeyEncrypted
});
const groqKey = settings?.groqApiKey || process.env.GROQ_API_KEY;  # ❌

# outreach.ts /send — WRONG  
select: { resendApiKey: true, resendFromEmail: true }  # ❌ resendApiKey doesn't exist
const resendKey = settings?.resendApiKey || ...         # ❌

# Should be:
select: { groqApiKeyEncrypted: true }
const groqKey = settings?.groqApiKeyEncrypted ? decrypt(settings.groqApiKeyEncrypted) : process.env.GROQ_API_KEY;

select: { resendApiKeyEncrypted: true, resendFromEmail: true }
const resendKey = settings?.resendApiKeyEncrypted ? decrypt(settings.resendApiKeyEncrypted) : process.env.RESEND_API_KEY;
```

This is the exact security issue the blueprint calls out in §2.6 — currently the keys are in encrypted columns but the outreach code is trying to read the raw (non-existent) columns, so it falls back to the env var and **user-specific Resend keys never work**.

---

### Bug 3 — `settings.ts` references `User.workerToken` which doesn't exist in schema

**File:** [`api/src/routes/dashboard/settings.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\routes\dashboard\settings.ts) lines 99–112

```diff
# settings.ts
const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { workerToken: true } });
await prisma.user.update({ where: { id: req.userId }, data: { workerToken: newToken } });
```

The Prisma schema `User` model has **no `workerToken` field**. Worker auth is via `WorkerSession` table. This will throw a Prisma type error at build time.

**Fix:** The worker pairing token pattern uses `WorkerSession`, not a column on `User`. These routes need to create/update `WorkerSession` rows instead.

---

### Bug 4 — `followupCron.ts` uses `f.email` but model field is `f.toEmail`

**File:** [`api/src/jobs/followupCron.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\jobs\followupCron.ts) line 82, 87, 97

```diff
const unsubUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(f.email)}`;  # ❌
{ from: fromEmail, to: [f.email], subject, html }   # ❌
console.log(`[CRON] ✓ Follow-up #${f.followupStep} → ${f.email}`);  # ❌
# All should be f.toEmail
```

---

### Bug 5 — `api/src/lib/supabase.ts` still exists (dead code + bad import risk)

**File:** [`api/src/lib/supabase.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\lib\supabase.ts)

The blueprint (§5.2) says *"Remove `@supabase/supabase-js` from `package.json`"*. The file still exists and `@supabase/supabase-js` is still in [`api/package.json`](file:///c:\Users\ADAM\Desktop\autoreach\api\package.json) line 18. If anything imports it accidentally, it will attempt to use undefined env vars.

---

### Bug 6 — `dashboard/lib/supabase.ts` still uses Supabase realtime

**File:** [`dashboard/lib/supabase.ts`](file:///c:\Users\ADAM\Desktop\autoreach\dashboard\lib\supabase.ts)

This file creates a Supabase channel for realtime updates. The blueprint says to replace this with an `EventSource` SSE client pointing to `/api/dashboard/stream`. The `@supabase/supabase-js` package is still in [`dashboard/package.json`](file:///c:\Users\ADAM\Desktop\autoreach\dashboard\package.json) line 28.

The `useLeadStream()` hook **does not exist** — nothing connects to the SSE stream from the dashboard side.

---

### Bug 7 — `worker/package.json` has wrong `extraMetadata.apiBaseUrl`

**File:** [`worker/package.json`](file:///c:\Users\ADAM\Desktop\autoreach\worker\package.json) line 52

```diff
- "extraMetadata": { "apiBaseUrl": "https://api.creativeleads.app" }
+ "extraMetadata": { "apiBaseUrl": "https://leads.creativecomet.tn" }
```

This is the "wrong server" bug from blueprint §2.2. The CI env var correctly sets `API_BASE_URL` but the `extraMetadata` hardcodes the old domain.

---

### Bug 8 — `worker/src/main/index.ts` — `open-dashboard` IPC points to old domain

**File:** [`worker/src/main/index.ts`](file:///c:\Users\ADAM\Desktop\autoreach\worker\src\main\index.ts) line 246

```diff
- shell.openExternal('https://app.autoreach.dev');
+ shell.openExternal('https://leads.creativecomet.tn');
```

---

### Bug 9 — `worker` Electron builder icons missing

**File:** [`worker/package.json`](file:///c:\Users\ADAM\Desktop\autoreach\worker\package.json) lines 48–50

The build config references:
- `"icon": "assets/icon.ico"` (Windows)
- `"icon": "assets/icon.icns"` (macOS)
- `"icon": "assets/icon.png"` (Linux)

The `worker/assets/` directory **does not exist**. The `copy_icons.py` script copies `favicon.ico` → `desktop/icon.ico` (for PyInstaller), but the **Electron builder** needs its own `worker/assets/` directory with the correct icon files. **The Electron build will fail.**

> **How to get the right sizes:**
> 1. Take `img/logo.png` (the 512×512 source).
> 2. For **Windows `.ico`**: Use [icoconvert.com](https://icoconvert.com) — upload `logo.png`, select sizes 16, 32, 48, 64, 128, 256 → download `.ico`.
> 3. For **macOS `.icns`**: On a Mac, run: `mkdir icon.iconset && sips -z 512 512 logo.png --out icon.iconset/icon_512x512.png && iconutil -c icns icon.iconset`. Alternatively use [cloudconvert.com](https://cloudconvert.com/png-to-icns).
> 4. For **Linux `.png`**: Already have it — just copy `img/android-chrome-512x512.png`.
> 5. Place all three in `worker/assets/` and update `copy_icons.py` to copy them there.

---

## 🟡 Missing Features (Not Yet Built)

### Missing 1 — ARIA Chatbot route on Node API

**Blueprint §7.6:** `POST /api/dashboard/aria` does not exist.  
The original logic lives in `app.py`. It needs to be ported to a new route file `api/src/routes/dashboard/aria.ts` and registered in the dashboard router. This blocks the chatbot in the web UI.

---

### Missing 2 — Public `/unsubscribe` route on the API

**Blueprint §5.2:** `GET /unsubscribe` is a public (no-auth) route that sets `unsubscribed = true` and `stage = 'Unsubscribed'`. The webhook handles incoming Resend events but there's **no HTTP route** that handles a user clicking the unsubscribe link from an email.

Currently `unsubUrl` in emails points to `APP_BASE_URL/unsubscribe?email=...` — if there's no corresponding Next.js page or API route handling this, all unsubscribe clicks 404.

Check [`dashboard/app/unsubscribe`](file:///c:\Users\ADAM\Desktop\autoreach\dashboard\app\unsubscribe) — if the page doesn't call the API to actually set the flag, it's incomplete.

---

### Missing 3 — `useLeadStream()` SSE hook in dashboard

**Blueprint §5.3:** The dashboard must have a `useLeadStream()` hook using `EventSource` connecting to `/api/dashboard/stream`. Currently `dashboard/hooks/` contains only `useLeads.ts`. **Real-time lead updates from the desktop worker do not appear in the web UI without a page refresh.**

---

### Missing 4 — `/download` page release manifest fetch

**Blueprint §7.4:** The `/download` page should fetch `manifest.json` to show download links dynamically. Verify [`dashboard/app/download`](file:///c:\Users\ADAM\Desktop\autoreach\dashboard\app\download) is reading the VPS manifest and not showing hardcoded links.

---

### Missing 5 — `/dashboard/scrape` page

**Blueprint §5.3:** The dashboard scrape page should show: worker online/offline status (via `GET /api/worker/status`), scrape controls (city, business type, max results, start button), and receive SSE progress updates. This page is not in the scanned directory listing.

---

### Missing 6 — Prisma migration file

**Blueprint Phase 2:** `prisma migrate dev` should have been run locally to generate a `migrations/` folder and committed migration SQL. Currently `api/prisma/` only contains `schema.prisma` — **no `migrations/` folder exists**. On deploy, `prisma migrate deploy` (called in `deploy.sh`) will fail with no migrations to run.

**Fix:** Run `npx prisma migrate dev --name init` locally against a real Postgres instance, commit the generated `api/prisma/migrations/` folder.

---

## 🗑️ Files to Delete (Blueprint §5.1)

These files exist in the repo and should be removed. They are replaced by the Node API + Next.js stack.

| File/Directory | Reason |
|---|---|
| [`app.py`](file:///c:\Users\ADAM\Desktop\autoreach\app.py) | Flask monolith — replaced by `api/` + `dashboard/` |
| [`auth.py`](file:///c:\Users\ADAM\Desktop\autoreach\auth.py) | Flask OAuth — replaced by NextAuth |
| [`followup.py`](file:///c:\Users\ADAM\Desktop\autoreach\followup.py) | Replaced by `api/src/jobs/followupCron.ts` |
| [`emailer.py`](file:///c:\Users\ADAM\Desktop\autoreach\emailer.py) | Replaced by `api/src/routes/dashboard/outreach.ts` |
| [`lead_finder.py`](file:///c:\Users\ADAM\Desktop\autoreach\lead_finder.py) | Replaced by Electron Playwright scraper |
| [`email_scraper.py`](file:///c:\Users\ADAM\Desktop\autoreach\email_scraper.py) | Replaced by Electron scraper |
| [`main.py`](file:///c:\Users\ADAM\Desktop\autoreach\main.py) | Flask entry point |
| [`scheduler.py`](file:///c:\Users\ADAM\Desktop\autoreach\scheduler.py) | Replaced by node-cron |
| [`report_generator.py`](file:///c:\Users\ADAM\Desktop\autoreach\report_generator.py) | Not in blueprint |
| [`templates/`](file:///c:\Users\ADAM\Desktop\autoreach\templates) | Jinja2 HTML — replaced by Next.js pages |
| [`autoreach_core/`](file:///c:\Users\ADAM\Desktop\autoreach\autoreach_core) | Python CLI core — replaced entirely |
| [`cli/`](file:///c:\Users\ADAM\Desktop\autoreach\cli) | Python CLI — replaced entirely |
| [`desktop/`](file:///c:\Users\ADAM\Desktop\autoreach\desktop) | Python/CustomTkinter app — replaced by `worker/` (Electron) |
| [`render.yaml`](file:///c:\Users\ADAM\Desktop\autoreach\render.yaml) | Not deploying to Render |
| [`api/railway.toml`](file:///c:\Users\ADAM\Desktop\autoreach\api\railway.toml) | Not deploying to Railway |
| [`Procfile`](file:///c:\Users\ADAM\Desktop\autoreach\Procfile) | Heroku — not used |
| [`requirements.txt`](file:///c:\Users\ADAM\Desktop\autoreach\requirements.txt) | Python deps — no Python server remains |
| [`db.py`](file:///c:\Users\ADAM\Desktop\autoreach\db.py) | Python SQLite layer — replaced by Prisma |
| [`api/src/lib/supabase.ts`](file:///c:\Users\ADAM\Desktop\autoreach\api\src\lib\supabase.ts) | Supabase removed per blueprint §2.8 |
| [`dashboard/lib/supabase.ts`](file:///c:\Users\ADAM\Desktop\autoreach\dashboard\lib\supabase.ts) | Replace with SSE `EventSource` hook |
| [`aria-proxy/`](file:///c:\Users\ADAM\Desktop\autoreach\aria-proxy) | ARIA proxy — port logic to Node API route |
| [`autoreach_flutter/`](file:///c:\Users\ADAM\Desktop\autoreach\autoreach_flutter) | Flutter mobile app — not in current blueprint scope |
| [`worker/src/renderer/`](file:///c:\Users\ADAM\Desktop\autoreach\worker\src\renderer) | Per blueprint §5.4: main window loads VPS URL now; only the tray popup remains bundled. If tray popup is not a separate BrowserWindow yet, this can stay temporarily, but the full renderer React app is no longer needed as a main window. |

---

## 📋 Build Readiness Checklist

### API (`api/`) — will NOT build cleanly today

- [ ] **Fix Bug 1** — rename `dateSent` → `sentAt`, `fromEmail` → `senderEmail`, `email` → `toEmail` in `outreach.ts`, `stats.ts`, `followupCron.ts`
- [ ] **Fix Bug 2** — change `outreach.ts` to read encrypted fields and decrypt them
- [ ] **Fix Bug 3** — remove `User.workerToken` references from `settings.ts`; use `WorkerSession` table
- [ ] **Fix Bug 4** — change `f.email` → `f.toEmail` in `followupCron.ts`
- [ ] Delete `api/src/lib/supabase.ts` and remove `@supabase/supabase-js` from `api/package.json`
- [ ] Create Prisma migration (`npx prisma migrate dev --name init`) and commit `migrations/` folder
- [ ] Add ARIA chatbot route

### Dashboard (`dashboard/`) — will build but is functionally incomplete

- [ ] Delete `dashboard/lib/supabase.ts`; remove `@supabase/supabase-js` from `dashboard/package.json`
- [ ] Create `dashboard/hooks/useLeadStream.ts` using `EventSource`
- [ ] Verify `/dashboard/scrape` page exists and uses worker status + SSE
- [ ] Verify `/download` page reads VPS manifest
- [ ] Verify `/unsubscribe` page calls the API to set the flag

### Worker (`worker/`) — will NOT build cleanly today

- [ ] **Fix Bug 7** — change `extraMetadata.apiBaseUrl` in `worker/package.json`
- [ ] **Fix Bug 8** — change `open-dashboard` IPC to use correct URL
- [ ] **Fix Bug 9** — create `worker/assets/` directory with `icon.ico`, `icon.icns`, `icon.png`

### Infra — not deployable today

- [ ] Commit `api/prisma/migrations/` folder (currently missing — `prisma migrate deploy` in `deploy.sh` will fail)
- [ ] Set all GitHub Actions secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `WORKER_SECRET`
- [ ] Create `.env` file on VPS with all values from `.env.example`

---

## Priority Order

```
1. Fix Bugs 1–4 in the API      ← unblocks `npm run build` in api/
2. Fix Bug 9 (worker assets)    ← unblocks `npm run dist:*` in worker/
3. Fix Bugs 7–8 (worker URLs)   ← correctness
4. Delete Supabase files        ← clean build environment
5. Run prisma migrate dev       ← unblocks VPS deploy
6. Create useLeadStream hook    ← real-time UX
7. Add ARIA + unsubscribe route ← feature completeness
8. Delete legacy Python files   ← repo hygiene (safe to do any time)
```
