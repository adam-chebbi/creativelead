# AutoReach V2 — /blueprint

## Full System Flow

```
User signs up on dashboard (Next.js)
  └─> Downloads Electron worker from /download page
        └─> Pastes worker token into worker UI
              └─> Worker pings API bridge (Express) to verify token
                    └─> Worker fetches scraping config (jobs queue)
                          └─> User clicks Start Scraping
                                └─> Worker detects user's real browser (Chrome/Edge/Brave)
                                      └─> Playwright opens that browser VISIBLY (headless: false)
                                            └─> Warm-up: google.com → random browse → maps.google.com
                                                  └─> Search: types query with human delays + typos
                                                        └─> Scroll loop: collects listings lazily
                                                              └─> Detail scraping: visits each URL
                                                                    └─> Reviews: navigates Reviews tab,
                                                                          sorts Newest, scrolls 50 reviews
                                                                              └─> Upload lead → get DB id
                                                                                    └─> Upload reviews by id
                                                                                          └─> Realtime broadcast
                                                                                                └─> Dashboard live
```

---

## Issues Found & Fixed

### CRITICAL — Scraper

**[FIXED] Issue 1: Wrong browser launched**
- Was: `chromium.launchPersistentContext` with no `executablePath` always launched
  Playwright's bundled Chromium, NOT the user's real browser.
- Fix: Added `worker/src/main/scraper/browser.ts` — detects Chrome/Edge/Brave
  executable path cross-platform (Win/Mac/Linux). Passes `executablePath` to
  `launchPersistentContext`. Falls back to bundled Chromium only if none found.
- Why it matters: The "watch it work" feature requires the user's OWN browser
  to open. This is the core product differentiator.

**[FIXED] Issue 2: Reviews never actually uploaded**
- Was: `engine.ts` uploaded the lead, then tried to upload reviews but had no
  business DB ID to call `POST /api/worker/lead/:id/reviews`. Reviews were silently dropped.
- Fix: After uploading a lead, engine queries `GET /api/dashboard/leads?search=name`
  to retrieve the DB ID by matching `googleMapsUrl`, then calls the reviews endpoint.
  `reviewsCollected` counter now tracked and reported in `session/end`.

**[FIXED] Issue 3: `reviewsCollected` always 0 in session/end**
- Was: `engine.emit('complete', { leadsCollected, reviewsCollected: 0 })` hardcoded 0.
- Fix: Class-level `this.reviewsCollected` counter incremented per business.

**[FIXED] Issue 4: `navigator.webdriver` fingerprint exposed**
- Was: Playwright sets `navigator.webdriver = true` by default, which Google detects.
- Fix: Added `page.addInitScript` to override `navigator.webdriver` to `undefined`.
  Also added `--disable-blink-features=AutomationControlled` launch arg.

**[FIXED] Issue 5: Results panel selector too fragile**
- Was: `[role="feed"]` only — Google Maps changes class names frequently.
- Fix: `search.ts` now uses a prioritised fallback chain:
  `[role="feed"]` → `div[aria-label*="Results"]` → `.m6QErb[aria-label]` → `.m6QErb`

**[FIXED] Issue 6: Review deduplication by author name**
- Was: `seenAuthors.add(authorName)` — two people with the same name caused the
  second review to be skipped.
- Fix: Dedup by DOM position index (`r.idx >= reviews.length`). Collects exactly
  the first 50 reviews in order.

**[FIXED] Issue 7: `Browser` type used instead of `BrowserContext`**
- Was: `private browser: Browser` — `launchPersistentContext` returns a
  `BrowserContext`, not a `Browser`. TypeScript error at runtime.
- Fix: Changed to `private context: BrowserContext`.

---

### CRITICAL — Dependencies

**[FIXED] Issue 8: `electron-log` missing from package.json**
- Was: `updater.ts` imports `electron-log` but it was not in `dependencies`.
  Worker would crash on startup with `Cannot find module 'electron-log'`.
- Fix: Added `"electron-log": "^5.1.5"` to `worker/package.json`.

**[FIXED] Issue 9: `build.files` missing renderer styles**
- Was: `src/renderer/styles.css` not included in electron-builder files array.
  Renderer would load unstyled in production builds.
- Fix: Added `src/renderer/styles.css` to `build.files`.

---

### IMPORTANT — Auth

**[FIXED] Issue 10: NextAuth JWT re-signed on every session refresh**
- Was: `jwt()` callback called `jwt.sign()` unconditionally on every token
  refresh, generating a new `accessToken` every 30s. API bridge rejected mid-session.
- Fix: Only sign `accessToken` when `token.accessToken` is not already set
  (i.e., only on initial login).

---

## Configuration Required Before Running

### API Bridge (`api/.env`)
```env
DATABASE_URL=postgresql://...          # Supabase transaction pooler URL
DIRECT_URL=postgresql://...            # Supabase direct URL (for migrations)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
JWT_SECRET=<SAME value as NEXTAUTH_SECRET in dashboard>
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=outreach@yourdomain.com
GROQ_API_KEY=gsk_...
APP_BASE_URL=https://app.autoreach.dev
PORT=3001
NODE_ENV=production
```

### Dashboard (`dashboard/.env.local`)
```env
NEXTAUTH_URL=https://app.autoreach.dev
NEXTAUTH_SECRET=<32-char random string — SAME as JWT_SECRET in API>
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_API_URL=https://api.autoreach.dev
GOOGLE_CLIENT_ID=...     # optional OAuth
GOOGLE_CLIENT_SECRET=... # optional OAuth
GITHUB_CLIENT_ID=...     # optional OAuth
GITHUB_CLIENT_SECRET=... # optional OAuth
DATABASE_URL=postgresql://...  # same Supabase URL
DIRECT_URL=postgresql://...
```

### Worker
No `.env` file needed. Config stored in `electron-store` (encrypted on disk).
Only `apiBaseUrl` is baked in at build time via `electron-builder.extraMetadata`.

---

## Scraping Engine — Free Tools Only

| Step | Tool | Cost |
|------|------|------|
| Browser automation | Playwright (MIT license) | Free |
| Browser used | User's own Chrome/Edge/Brave | Free |
| Maps navigation | Direct URL to maps.google.com | Free |
| Lead discovery | DOM scraping of Maps results panel | Free |
| Detail extraction | DOM scraping of Maps business pages | Free |
| Reviews extraction | DOM scraping of Maps Reviews tab (50 max) | Free |
| Email sending | Resend (3,000/month free tier) | Free |
| AI copy | Groq LLaMA 3.1 (free tier) | Free |
| Database | Supabase (500MB free tier) | Free |
| API hosting | Railway (free tier) | Free |
| Dashboard hosting | Vercel (free tier) | Free |

**No Google Maps API. No paid scraping services. No proxies. No 3rd party scraping tools.**

---

## Human-Like Behavior Implemented

- `humanType`: per-character delays 60-180ms, 15% typo+backspace rate
- `humanClick`: random point inside bounding box (not center)
- `humanScroll`: step-based 80-200px, 20% reversal, 100-400ms between steps
- `humanWait`: random range waits throughout all operations
- `humanMouseMove`: curved path with 3-5 waypoints
- `slowMo`: 40-80ms random per Playwright action
- Warm-up: google.com → optional random browse/search → Maps
- Persistent browser profile: looks like returning user, not fresh session
- `navigator.webdriver` removed from page context
- `--disable-blink-features=AutomationControlled` launch flag
- 1.2-2.5s wait between each business detail page visit
