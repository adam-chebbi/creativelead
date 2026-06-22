# AutoReach — SaaS Completion Blueprint

> **Version:** 1.0 — Draft  
> **Scope:** What is missing to make this a professional, production-grade SaaS.  
> This document contains no code. It is a product and architecture specification.  
> Billing, payments, email sending, account verification, and newsletters are **explicitly out of scope** — the product is free and open to all users from day one, no verification required.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Gap Matrix](#2-complete-gap-matrix)
3. [Critical Gap #1 — Role-Based Access Control & Admin Panel](#3-critical-gap-1--role-based-access-control--admin-panel)
4. [Critical Gap #2 — Desktop OAuth Token Sync](#4-critical-gap-2--desktop-oauth-token-sync)
5. [Reliability, Observability & Infrastructure](#5-reliability-observability--infrastructure)
6. [Security Hardening](#6-security-hardening)
7. [User Experience Completeness](#7-user-experience-completeness)
8. [Legal & Compliance](#8-legal--compliance)
9. [Implementation Roadmap](#9-implementation-roadmap)
10. [Appendix — What is Already Working](#10-appendix--what-is-already-working)

---

## 1. Executive Summary

AutoReach is a lead-generation SaaS composed of three layers: a Next.js web dashboard, a headless Node.js API, and an Electron-based desktop worker that scrapes Google Maps using a locally controlled browser. The core scraping engine, data pipeline, and basic dashboard are operational.

**The product is intentionally free and open.** No billing, no email verification, no subscription tiers. Anyone who signs in via OAuth gets immediate full access. This keeps the architecture simple and the onboarding frictionless.

Despite this simplified model, several gaps prevent AutoReach from being considered a professional, production-grade SaaS. This document catalogues every missing piece across four domains: **authorization**, **desktop authentication UX**, **reliability**, and **user experience**.

> **The two most urgent gaps are:**
> 1. Authentication exists but authorization (roles + admin panel) does not.
> 2. The desktop app requires manual token paste — this is not acceptable in a modern SaaS.

---

## 2. Complete Gap Matrix

Items removed from scope: billing/Stripe, subscription plans, email verification, welcome emails, newsletters, invoice delivery, payment webhooks, free trial logic, cookie consent (no tracking).

| Feature / Capability | Status | Priority |
|---|---|---|
| **Authorization & Admin** | | |
| Role-based access control (RBAC) | ❌ Missing | 🔴 Critical |
| Admin panel with user management | ❌ Missing | 🔴 Critical |
| Desktop ↔ Web seamless OAuth token sync | ❌ Missing | 🔴 Critical |
| Session invalidation & device management | ❌ Missing | 🟠 High |
| Audit log (who did what, when) | ❌ Missing | 🟡 Medium |
| **Infrastructure & Reliability** | | |
| Rate-limit API endpoints | ❌ Missing | 🟠 High |
| Global error boundary & fallback UI | ❌ Missing | 🟠 High |
| Structured server-side logging | ❌ Missing | 🟠 High |
| Worker crash auto-restart | ❌ Missing | 🟡 Medium |
| Health-check endpoint (complete) | 🟡 Incomplete | 🟡 Medium |
| Database connection pooling (PgBouncer) | ❌ Missing | 🟡 Medium |
| **Security** | | |
| CSRF protection on all mutations | ❌ Missing | 🔴 Critical |
| Input sanitization & validation (Zod) | 🟡 Incomplete | 🟠 High |
| Secrets rotation strategy documented | ❌ Missing | 🟠 High |
| Content-Security-Policy headers | ❌ Missing | 🟡 Medium |
| Dependency audit pipeline (npm audit) | ❌ Missing | 🟡 Medium |
| **User Experience** | | |
| Empty states (no leads, no sessions) | ❌ Missing | 🟡 Medium |
| Global toast / notification system | 🟡 Incomplete | 🟡 Medium |
| Real-time scraping progress on web dashboard | ❌ Missing | 🟡 Medium |
| Lead deduplication indicator | ❌ Missing | 🟡 Medium |
| Bulk export (CSV, XLSX) with column mapping | 🟡 Incomplete | 🟡 Medium |
| Lead detail modal / side panel | ❌ Missing | 🟡 Medium |
| Advanced filter & sort on leads table | 🟡 Incomplete | 🟡 Medium |
| Desktop app download page with OS detection | ❌ Missing | 🟡 Medium |
| Desktop auto-update (electron-updater) | ❌ Missing | 🟡 Medium |
| First-run onboarding checklist (in-app) | ❌ Missing | 🟡 Medium |
| **Legal** | | |
| Terms of Service page | ❌ Missing | 🟠 High |
| Privacy Policy page | ❌ Missing | 🟠 High |
| Data deletion (right to be forgotten) flow | ❌ Missing | 🟡 Medium |

---

## 3. Critical Gap #1 — Role-Based Access Control & Admin Panel

### 3.1 What exists today

NextAuth is configured with GitHub and Google OAuth providers. There is a `User` model in Prisma. There is **no role field** on the user, no middleware that restricts routes by role, and no admin-only interface anywhere in the codebase. Any authenticated user currently has identical access to all parts of the application.

### 3.2 What is missing

#### 3.2.1 Role field on the User model

The `User` table must gain a `role` column with at least three possible values: `USER`, `ADMIN`, and `SUPER_ADMIN`. The default value for all new signups is `USER`. Role assignment is performed only through the admin panel or directly in the database by a `SUPER_ADMIN`. No self-service role escalation is possible.

#### 3.2.2 Middleware-level route protection

Every request that reaches a protected Next.js route or API endpoint must pass through a centralized authorization check. The check must verify both that the user is authenticated **and** that their role satisfies the minimum required role for that resource.

- Unauthenticated requests → redirect to `/login`
- Authenticated requests with insufficient role → `403 Forbidden`
- All authorization decisions must be enforced server-side, never client-side only

#### 3.2.3 Admin Panel — `/admin` route group

The admin panel lives under a `/admin` route group that requires `role >= ADMIN`. It must be invisible in the navigation for non-admins and must not be publicly discoverable. It must contain the following pages:

**User List**
A paginated table of all registered users showing: name, email, role, created date, last active timestamp, and total lead count. Supports search by email and filter by role.

**User Detail**
Individual user view with the ability to:
- Change the user's role (`USER` → `ADMIN` or back)
- Suspend or reinstate an account
- View that user's scraping sessions and exported leads
- Delete the user's account and all associated data

**Impersonation**
A `SUPER_ADMIN` can log in as any `USER` for debugging and support purposes. While impersonating, a persistent banner is displayed at the top of every page identifying the session as an impersonation. Impersonation sessions expire after 1 hour or on manual exit. Every impersonation event is written to the audit log.

**Usage Overview**
Aggregate metrics visible at a glance:
- Total registered users
- Total leads ever scraped
- Scraping sessions started today / this week / this month
- Currently active desktop workers

**Feature Flags**
A list of toggleable boolean flags (e.g., `maintenance_mode`, `enable_bulk_export_v2`) that take effect immediately without a deployment. Flags are stored in the database and read by the application at runtime.

**Audit Log**
A timestamped, append-only record of every admin action: role changes, account suspensions, user deletions, and impersonations. Each entry records: actor ID, actor email, target ID (if applicable), action name, and ISO timestamp. The log is read-only — no admin can delete entries.

> **Design principle:** The admin panel must never be reachable by a `USER`-role account under any circumstance, including URL guessing. All admin routes must perform a server-side role check on every request, not just at the layout level.

---

## 4. Critical Gap #2 — Desktop OAuth Token Sync

### 4.1 The current problem

The Electron desktop worker currently requires the user to manually paste a token into the app to authenticate. This is a severe UX regression compared to every industry-standard desktop SaaS application. A user who has already authenticated on the web should **never** need to touch a token string. This pattern is not acceptable in a professional product.

### 4.2 How leading apps handle this

| App | Mechanism |
|---|---|
| **Figma** | Clicking "Open in Desktop" triggers `figma://` deep link. Desktop receives a short-lived code, exchanges it silently, opens the file. |
| **Linear** | OAuth completes in browser, redirects to `linear://auth?code=...`. Desktop is already listening via registered protocol. |
| **Notion / Slack** | Browser redirects to `notion://` or `slack://` with auth payload. Native app receives it via OS protocol registration and establishes session instantly. |

The standard is: **the user authenticates once in the browser, the desktop detects it automatically, and the session appears without any manual step.**

### 4.3 The correct architecture

#### Step 1 — Custom protocol registration

The Electron app registers a custom URL scheme with the operating system during installation: `autoreach://`.

- **Windows:** registry entry under `HKEY_CLASSES_ROOT`
- **macOS:** declared in `Info.plist` as a URL type
- **Linux:** `.desktop` file registered with `xdg-mime`

Once registered, any link starting with `autoreach://` clicked anywhere on that machine causes the OS to open the desktop app and pass the URL as a launch argument.

#### Step 2 — Web triggers the deep link

After a successful OAuth login on the web dashboard, the web app checks whether the user arrived from a desktop-initiated auth request. This is detected via a query parameter embedded by the desktop when it opens the browser:

```
https://app.autoreach.io/login?source=desktop&device_id=DEVICE_UUID
```

If `source=desktop` is present, the web app — after session creation — generates a **short-lived, single-use authorization code** (not the full session token) and redirects the browser to:

```
autoreach://auth?code=XXXX
```

The browser does not handle this URL. The OS intercepts it and passes it to the Electron app.

#### Step 3 — Desktop receives and exchanges the code

The Electron main process listens for:
- The `second-instance` event (Windows/Linux, when the OS re-launches the app)
- The `open-url` event (macOS)

When the OS delivers the `autoreach://auth?code=XXXX` URL, the main process extracts the code and makes a **server-side POST request** to a dedicated `/api/desktop/exchange` endpoint on the AutoReach API.

The API:
1. Validates the code exists and has not expired (60-second TTL)
2. Validates the code is tied to the `device_id` that initiated the request
3. Marks the code as used (single-use)
4. Returns a long-lived session token (JWT or opaque token)

The session token is stored in the **OS keychain** via the `keytar` library — never in `electron-store`, `localStorage`, or a plain config file.

#### Step 4 — Polling fallback

For the edge case where the user authenticates in a browser on a different machine (e.g., their phone), the desktop app polls `/api/desktop/pending-auth` every 3 seconds while in the unauthenticated state.

- The desktop sends its `device_id` with each poll
- When the server detects a successfully redeemed code for that `device_id`, it returns the session token
- Polling stops immediately once a session is established

#### Step 5 — The "Sign In" button

Instead of a token input field, the unauthenticated desktop UI shows a single **"Sign In with Browser"** button. Clicking it:

1. Generates a local `device_id` (UUID stored in the OS keychain, created once at install time)
2. Opens the user's default browser to `https://app.autoreach.io/login?source=desktop&device_id=DEVICE_UUID`
3. Starts the polling loop in the background
4. Waits — either for the deep link callback or for the poll to return a session

The user completes OAuth in their browser. The desktop transitions to the authenticated state automatically. **The user never sees a token.**

> **Security constraints for the token exchange:**
> - The authorization code must be single-use and expire after 60 seconds
> - The code must be cryptographically tied to the `device_id` that initiated the request — a code cannot be redeemed by a different device
> - The final session token must be stored in the OS keychain (`keytar`), not in any plain file
> - The `/api/desktop/exchange` endpoint must be rate-limited to 5 attempts per device per minute
> - The `device_id` is generated once at install time and is stable across app restarts — it is not the same as a session token

---

## 5. Reliability, Observability & Infrastructure

### 5.1 Structured logging

The current codebase uses `console.log` throughout. A production SaaS requires structured logging. Every request to the API should emit a JSON log line containing: request ID, HTTP method, path, status code, response duration, user ID (if authenticated), and any error stack trace.

Logs should be written to stdout in JSON format (compatible with log aggregation tools like Datadog, Loki, or CloudWatch). At minimum for self-hosted setups, logs should be written to rotating files that can be tailed in production without losing data on container restart.

### 5.2 Error boundaries

The Next.js dashboard has no global React error boundary. If any component throws an unhandled exception, the user sees a blank white screen with no recovery path. A professional application must:

- Wrap the entire app in a React error boundary
- Show a friendly error page with a "Reload" button when an unhandled error occurs
- Optionally report the error to an error tracking service (e.g., Sentry) with the user ID and the component stack trace

### 5.3 API rate limiting

The Express API has no rate limiting. A single client can flood any endpoint without consequence. The following limits must be enforced:

- **Unauthenticated requests to `/api/auth/*`:** 20 requests per IP per minute
- **Scraping session start (`POST /api/sessions`):** 5 per user per hour — prevents abuse of the scraping infrastructure
- **`/api/desktop/exchange`:** 5 per device per minute
- **General authenticated endpoints:** 120 requests per user per minute

When a limit is exceeded, the API must return `429 Too Many Requests` with a `Retry-After` header.

### 5.4 Worker crash recovery

The Electron worker can crash mid-scrape with no recovery mechanism. Two improvements are required:

**Session interruption tracking:** When the worker process exits unexpectedly during an active session, the API should detect the connection drop and mark that session as `interrupted` in the database. The user can then resume it from the desktop UI rather than starting from scratch.

**Internal browser process auto-restart:** If the Playwright-controlled browser crashes without the user stopping the session, the worker should automatically relaunch the browser, restore its state, and continue the session — without requiring the user to reopen the app.

### 5.5 Database connection pooling

In production, each Docker container opens its own connection pool directly against PostgreSQL. Under load (multiple concurrent scraping sessions syncing leads), this can exhaust `max_connections`. PgBouncer should sit between the application containers and PostgreSQL as a connection multiplexer. This is especially important as concurrent worker count grows.

### 5.6 Health checks (complete implementation)

The `/api/health` endpoint exists in the deploy script but its depth is unclear. A complete health check must verify:

- **Database:** a `SELECT 1` completes within 500ms
- **Disk space:** the database volume has more than 10% free space
- **Queue depth:** the worker sync queue is not backed up beyond a configurable threshold (e.g., 500 pending items)

The response must be a structured JSON object with per-component statuses, not just `200 OK`. Example shape:

```json
{
  "status": "ok",
  "db": "ok",
  "disk": "ok",
  "queue": "ok",
  "uptime": 432190
}
```

If any component is degraded, the overall `status` is `degraded` and the HTTP status code is `503`.

---

## 6. Security Hardening

### 6.1 CSRF protection

All state-mutating API endpoints (`POST`, `PUT`, `DELETE`, `PATCH`) that accept session cookies must validate a CSRF token. NextAuth provides CSRF protection for its own endpoints, but any custom Express API endpoint that reads cookies is unprotected.

The recommended approach is the **double-submit cookie pattern**: the server sets a `csrf-token` cookie on login; every mutating request must include a matching `X-CSRF-Token` header; the server compares both values. Requests without a matching token are rejected with `403`.

### 6.2 Input validation

API endpoints accept user-supplied data (city, businessType, maxResults, etc.) without exhaustive server-side validation. Every input must be parsed through a schema validator before it reaches business logic or the database.

Validation must cover:
- Type correctness (string, number, boolean)
- Length bounds (city name max 100 chars, maxResults between 1 and 500)
- Allowed characters (no shell metacharacters in text inputs)
- Enum constraints where applicable (e.g., export format must be `csv` or `xlsx`)

Invalid inputs must return `400 Bad Request` with a structured error body describing which field failed and why.

### 6.3 Secrets management

The `.env` file in the repository contains real credentials: GitHub OAuth, Google OAuth, GROQ API key, encryption keys, and the worker secret. **These must never be committed to version control.**

In production, secrets must be injected via environment variables from a secrets manager. A documented rotation procedure must exist describing: how often each secret rotates, who can rotate it, and how to rotate without downtime (i.e., supporting both old and new values during a rolling deploy).

### 6.4 Security headers

The Next.js app does not configure HTTP security headers. The following must be added to every response:

| Header | Value |
|---|---|
| `Content-Security-Policy` | Restrictive policy allowing only trusted origins |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` |

These are first-line defenses against XSS, clickjacking, and MIME sniffing attacks and should be applied at the Nginx layer or in Next.js middleware.

### 6.5 Dependency auditing

There is no automated dependency audit in the CI/CD pipeline. `npm audit` must run as part of every build. Known high-severity or critical vulnerabilities must block the deployment. A tool such as Dependabot or Renovate should be configured to automatically open pull requests for dependency updates, keeping the dependency graph current without manual effort.

---

## 7. User Experience Completeness

### 7.1 First-run onboarding checklist

A new user who signs in lands on the dashboard with no guidance. Since there is no email onboarding (out of scope), the in-app experience must compensate. A first-run checklist should appear the first time a user logs in, guiding them through:

1. Downloading and installing the desktop worker
2. Opening the worker and clicking "Sign In with Browser"
3. Confirming the worker is connected (green status indicator on the web dashboard)
4. Running their first scrape

The checklist persists in a collapsed state in the sidebar until all steps are complete, then disappears. Progress is tracked per-user in the database (`onboardingCompletedAt` or a step bitmask).

### 7.2 Desktop app download page

There is no `/download` page. Users must somehow know to look for the desktop installer. The download page must:

- Detect the user's operating system via the `User-Agent` header and prominently feature the correct installer
- Provide download links for all three platforms (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`)
- Display a SHA-256 checksum for each installer so security-conscious users can verify integrity
- Show the current version number and a brief changelog summary

### 7.3 Empty states

Every list or data view must have a designed empty state. Currently, the leads table, sessions list, and exports page show nothing meaningful when empty. Each empty state must include:

- A relevant icon or simple illustration
- A one-sentence explanation of what this section is for
- A primary action button (e.g., "Start your first scrape" on the leads table)

### 7.4 Real-time scraping progress on the web

Scraping progress is visible only in the Electron desktop UI. The web dashboard shows no live feedback while a scrape is running. The API already maintains session state. The dashboard should use **polling or Server-Sent Events** to display a live progress bar, lead count, and status message for any in-progress session, allowing users to monitor from the web without keeping the desktop app visible.

### 7.5 Lead management improvements

**Lead detail panel** — clicking a lead row should open a side panel or modal with full details: address, phone, website, rating, review count, business category, and a link to the original Google Maps listing.

**Deduplication indicator** — when a lead already exists in the user's library from a previous session, it should be visually flagged (e.g., a subtle badge) rather than silently re-imported. The user can choose to update the existing record or skip.

**Bulk operations** — the leads table needs working multi-select enabling: bulk export, bulk delete, and bulk tag assignment.

**Column customization** — users should be able to show/hide columns in the leads table and have their preference persisted.

### 7.6 Desktop auto-update

The Electron app has no auto-update mechanism. Users who download version 1.0 are stuck on it forever unless they manually re-download. `electron-updater` integrated with a GitHub Releases endpoint must be configured so the app:

- Checks for updates on each launch
- Downloads the update in the background without interrupting the user
- Shows a non-blocking notification: "An update is ready — restart to apply"
- Applies the update on the next restart

---

## 8. Legal & Compliance

Even without billing, AutoReach collects, processes, and stores personal business data (names, phone numbers, addresses, websites). This carries legal obligations, especially under GDPR if serving European users.

### 8.1 Required pages

**Terms of Service** — defines what the service does, acceptable use policy (especially regarding scraping and data usage), limitation of liability, and governing jurisdiction. Must be linked from the login page and the app footer.

**Privacy Policy** — explains: what data is collected (OAuth identity, scraped lead data), how it is used, how long it is retained, and the user's rights (access, correction, deletion). Must be GDPR-compliant if serving EU users.

### 8.2 Data deletion

Users must be able to request deletion of their account and all associated data (leads, sessions, exports). Even though there is no billing, this is a legal requirement under GDPR Article 17.

The deletion flow must:
- Be accessible from the user's account settings page
- Require a confirmation step (type "DELETE" or confirm via a modal)
- Cascade-delete all associated records in the database
- Complete within 30 days (can be a soft-delete immediately followed by a background purge job)
- **Not** send a confirmation email (out of scope) — but must show an in-app confirmation immediately after the request is submitted

### 8.3 Data retention policy

Scraped lead data that belongs to deleted accounts must not be retained indefinitely. A documented internal policy must specify the maximum retention period (e.g., 30 days after account deletion) after which data is permanently and irrecoverably purged from the database and all backups.

---

## 9. Implementation Roadmap

Ordered by user-facing impact and technical dependency. Billing, email, and verification items are absent — they are out of scope for this phase of the product.

| Phase | Focus | Outcome |
|---|---|---|
| **Phase 1** | RBAC + Admin Panel + Desktop Token Sync | Product is internally manageable; desktop UX matches industry standard |
| **Phase 2** | Rate limiting + CSRF + Input validation + Structured logging | Product is protected from abuse and operationally observable |
| **Phase 3** | Error boundaries + Worker crash recovery + Health check completeness + PgBouncer | Product is resilient and its health is measurable |
| **Phase 4** | Empty states + Real-time web progress + Lead detail panel + Bulk operations + Download page + Desktop auto-update + Onboarding checklist | Product feels complete and polished to a new user |
| **Phase 5** | Terms of Service + Privacy Policy + Data deletion flow + Security headers + Dependency auditing | Product is legally compliant and hardened |

---

## 10. Appendix — What is Already Working

The following capabilities are confirmed present in the codebase and are **not** gaps requiring action.

- Core Electron desktop app with Playwright-powered Google Maps scraping
- Lead sync from desktop worker to API via authenticated HTTP
- PostgreSQL database with Prisma ORM and migration support
- NextAuth OAuth login (GitHub + Google) — authentication works; authorization does not exist yet
- Docker Compose production stack with Nginx reverse proxy
- GitHub Actions CI/CD pipeline with automated deploy script
- Basic leads table in the dashboard with CSV export
- Session management in the Electron app (start, pause, stop, resume)
- CAPTCHA detection and manual resume flow in the desktop UI
- Encrypted storage of worker tokens on disk
- Groq AI integration for lead enrichment and email generation
- Worker auto-connect with stored token on app reopen

---

*AutoReach SaaS Completion Blueprint — End of Document*