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
                                                                              └─> POST /api/worker/leads
                                                                                    └─> GET /api/worker/leads/find
                                                                                          └─> POST /api/worker/lead/:id/reviews
                                                                                                └─> Supabase Realtime broadcast
                                                                                                      └─> Dashboard updates live
```

---

## All Issues Found & Fixed (17 total)

### Batch 1 — Original audit

| # | Severity | File | Issue | Fix |
|---|---|---|---|---|
| 1 | 🔴 Critical | `engine.ts` | Wrong browser — always Playwright bundled Chromium, not user's real browser | Added `browser.ts` to detect Chrome/Edge/Brave path cross-platform |
| 2 | 🔴 Critical | `engine.ts` | Reviews silently dropped — no DB ID for `/lead/:id/reviews` endpoint | Upload lead first, then `GET /api/worker/leads/find` to get ID |
| 3 | 🔴 Critical | `engine.ts` | `reviewsCollected` always 0 in `session/end` | Class-level counter tracked properly |
| 4 | 🔴 Critical | `engine.ts` | `navigator.webdriver` exposed — Google detects automation | `addInitScript` on context + `--disable-blink-features=AutomationControlled` |
| 5 | 🟠 High | `search.ts` | Results panel selector `[role=feed]` too fragile | 4-selector fallback chain |
| 6 | 🟠 High | `reviews.ts` | Review dedup by author name — same name = skip | Dedup by DOM position index |
| 7 | 🟠 High | `engine.ts` | `Browser` type instead of `BrowserContext` — TypeScript crash | Fixed type |
| 8 | 🟠 High | `package.json` | `electron-log` missing — startup crash | Added to dependencies |
| 9 | 🟡 Medium | `package.json` | `styles.css` missing from electron-builder files | Added to `build.files` |
| 10 | 🟡 Medium | `options.ts` | NextAuth JWT re-signed every 30s — API rejects mid-session | Only sign on initial login |

### Batch 2 — Deep audit

| # | Severity | File | Issue | Fix |
|---|---|---|---|---|
| 11 | 🔴 Critical | `engine.ts` | `GET /api/dashboard/leads` used to find lead ID — requires dashboard JWT, worker only has worker token — would 401 | Added `GET /api/worker/leads/find?googleMapsUrl=` endpoint with worker auth |
| 12 | 🔴 Critical | `index.ts` | `preload.js` path wrong: `path.join(__dirname, '..', 'preload.js')` — preload compiles to `dist/main/preload.js` (same dir) | Fixed to `path.join(__dirname, 'preload.js')` |
| 13 | 🔴 Critical | `index.ts` | `sendToRenderer` called before window finishes loading — race condition on startup | Added `did-finish-load` guard via `sendToRenderer()` helper |
| 14 | 🟠 High | `client.ts` | `store.get('apiBaseUrl')` called at module load time before `electron-store` is initialized | Changed to lazy singleton via `getApiClient()` + Proxy |
| 15 | 🟠 High | `detail.ts` | `humanClick` called with multi-selector string — not a valid single CSS selector, throws | Changed to loop over selectors, find first matching element, call `.click()` directly |
| 16 | 🟠 High | `engine.ts` | `addInitScript` called on `page` only — new pages opened by Maps (popups) would still expose `webdriver` | Changed to `context.addInitScript()` so all pages in the context are patched |
| 17 | 🟡 Medium | `index.ts` | `stop-scraping` IPC didn't track `currentSessionId` — session never ended if user clicked Stop | Added `currentSessionId` class variable, used in `stop-scraping` handler |

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

- `humanType` — per-character delays 60-180ms, 15% typo+backspace rate
- `humanClick` — random point inside bounding box (not center)
- `humanScroll` — step-based 80-200px, 20% reversal, 100-400ms between steps
- `humanWait` — random range waits throughout all operations
- `humanMouseMove` — curved path with 3-5 waypoints
- `slowMo` — 40-80ms random per Playwright action
- Warm-up: google.com → optional random browse/search → Maps
- Persistent browser profile: looks like returning user, not fresh session
- `navigator.webdriver` removed from ALL pages in context (not just first page)
- `navigator.plugins` spoofed to non-empty array
- `--disable-blink-features=AutomationControlled` launch flag
- 1.2-2.5s wait between each business detail page visit
