# CreativeLead — Frontend & Backend Health Prompts Pack
### Optimized for a single small VPS (1 vCPU / 1–2GB RAM class), low idle energy, no extra infra

This pack is a set of ready-to-paste prompts you (or an AI coding agent working on this repo) can run one at a time. Every prompt is written with one hard constraint baked in: **everything must keep running comfortably on one small VPS**, so nothing here asks for a queue server, a separate cache server, a CDN account, or a second process unless it's something the OS/runtime already gives you for free. Where a "textbook" fix would normally reach for extra infrastructure, the prompt tells the agent to use the in-process, file-based, or already-available alternative instead.

Use these in order — later prompts assume earlier ones are done. Run them one at a time against the codebase and review the diff before moving to the next.

---

## 0. Ground Rules to Paste Before Any Other Prompt

**Prompt:**

"Before making any change in this repo, follow these constraints for the rest of this session: this app runs on a single small VPS with limited CPU and RAM, so treat every dependency addition as a cost. Prefer the smallest, tree-shakeable package available, avoid anything that spins up a background worker, a native binary, or a second Node process. Never add Redis, a message queue, a separate microservice, or a container sidecar — if a task seems to need one, solve it in-process or with a lightweight file/SQLite-backed alternative instead and say so explicitly. Keep the production build's dependency count as close to unchanged as possible; if you add a package, tell me its unpacked size and whether it has native bindings. Do not turn on any feature that polls in the background, keeps a persistent socket open without a real reason, or increases the base memory footprint of the Node process at idle. Every change should be judged not just on code quality but on CPU-at-idle and RAM-at-idle before and after."

---

## 1. Stop Calling APIs Directly Inside Components — Centralize Data Fetching

**Prompt:**

"Audit every component in this project that calls fetch, axios, or a Prisma/service call directly inside a component body, a useEffect, or an inline event handler. Replace this pattern everywhere with a single, shared data-fetching layer built on TanStack Query (React Query). Install only the core `@tanstack/react-query` package — skip devtools and any optional plugins in production builds, and only import devtools behind a development-only conditional so it never ships to the production bundle. Configure one QueryClient at the root of the app with conservative defaults: a stale time long enough that repeat visits to the same page don't refetch (start at 60 seconds minimum, longer for data that rarely changes like pricing or settings), retry count capped at 1 on a small VPS so a flaky request doesn't hammer the server with retries, and refetch-on-window-focus turned off unless a specific screen truly needs live data. For every data-fetching component, extract the fetch into a small custom hook named after what it fetches, and have the component just call that hook. Make sure duplicate calls to the same endpoint from different components on the same page collapse into a single network request through the shared cache instead of firing one request per component instance. Confirm no component still manages its own loading boolean or its own local copy of server data in state — that responsibility moves entirely to the query layer."

**Why it matters here:** one shared cache means the VPS answers far fewer API requests overall, which is the single biggest lever for keeping a small server's CPU and bandwidth low.

---

## 2. Break Up the One Giant Global Context

**Prompt:**

"Find every React Context in this project that holds more than one unrelated concern (for example a single context mixing user session, theme, UI modal state, and app-wide settings together). Split each of these into small, single-purpose contexts, one per concern, so a component that only needs the theme doesn't re-render when the session object changes. For state that many unrelated parts of the app read and write frequently — dashboards, filters, campaign builder state, settings forms — replace Context entirely with Zustand. Use a single small store per feature area rather than one giant store for the whole app, and use Zustand's selector pattern everywhere so components subscribe only to the exact slice of state they use, not the whole store. Do not add Redux Toolkit or any similar heavier state library — Zustand has a tiny runtime footprint and no boilerplate, which matters since this all has to run efficiently in the browser on visitors' machines, and it keeps the app's own JS bundle small, which reduces the number of bytes this VPS has to serve per page load. After the split, verify with React DevTools' render highlighting (or a quick console log in render) that changing one slice of state no longer causes unrelated components to re-render."

**Why it matters here:** unrelated re-renders waste client CPU and battery on visitors' devices, and a bloated single context tends to grow the JS bundle the VPS has to serve on every request — smaller, targeted stores keep both sides lean.

---

## 3. Split Up Huge Components

**Prompt:**

"Identify every component file in this project over roughly 300 lines or that mixes more than one responsibility — data fetching, business logic/calculations, layout markup, and event handling all in one file. For each one, split it along these lines: move data-fetching logic into a custom hook under a `hooks/` folder named for what it does; move pure calculation, formatting, or business-rule logic (like the pricing formula, scoring weights, or threshold logic already used in the settings screens) into plain functions under a `utils/` or `services/` folder with no React or UI code in them at all, so they're independently testable and reusable server-side or client-side; keep the component file itself focused only on layout and wiring the hook and utils together. Do not introduce a heavier folder-per-feature framework or code-generation tool for this — plain hooks/components/services/utils folders are enough, adding tooling on top would only cost build time and dependencies on a small VPS. As you split each file, keep an eye out for logic that's duplicated across multiple large components (for example the same date formatting, the same scoring math, the same status label logic) and consolidate it into one shared utility instead of leaving copies behind."

**Why it matters here:** smaller, focused files build faster and produce smaller, more cacheable chunks — both of which matter when the VPS itself is doing the production build.

---

## 4. Build Loading, Error, and Empty States for Every Data View

**Prompt:**

"Go through every screen or component in this project that displays data fetched from the network or the database and check whether it currently just renders nothing, renders a blank space, or crashes while data is loading, missing, or the request has failed. For each one, add three explicit states: a lightweight skeleton placeholder shown while loading that matches the rough shape of the real content (avoid heavy animation libraries for this — a simple CSS pulse/shimmer is enough and costs nothing extra to render); a clear error state shown when the request fails, with a short human-readable message and a retry action that re-triggers the same query rather than a full page reload; and an empty state shown when the request succeeds but returns no rows, distinct from both the loading and error states, with a short explanation of why the view might be empty and what action the user can take next. Wire all three states off the query hook's own status flags (loading, error, and data-length checks) rather than inventing new local booleans to track. Do this consistently across the dashboard, review management, campaign, and settings screens so no view in the app can silently show a blank white area to a user on a slow connection or when the VPS is briefly under load."

**Why it matters here:** small VPS setups are more likely to have occasional slow responses under load — clear loading and error states stop users from thinking the app is broken and retrying/reloading, which itself would create more load on the server.

---

## 5. Cache Data So It Isn't Re-Fetched on Every Page Visit

**Prompt:**

"For every page in this app that a user is likely to revisit during a session — dashboard, settings, pricing configuration, provider credentials, review thresholds — configure the TanStack Query cache so that navigating away and back does not trigger a fresh network request if the data is still reasonably fresh. Set per-query stale times based on how often the underlying data actually changes: settings and pricing config should be treated as long-lived (several minutes to session-length, since they're edited rarely), while anything showing live campaign or review activity can have a shorter stale time. For data the user is likely to want available even after closing and reopening the browser tab in the same session, use TanStack Query's persistence to localStorage with a small size cap, rather than reaching for a server-side cache layer. Do not introduce a separate caching service, in-memory server cache process, or third-party cache database for this — the goal is to avoid the network round trip and the server-side compute entirely when the data hasn't changed, using only the client cache and, where it already exists, HTTP cache headers on API responses that don't change per request. Where an API route serves data that's identical for every user for a period of time (like published pricing tiers), add appropriate cache-control headers on that route's response so even a hard refresh can be served from the browser or an intermediary cache instead of hitting the database again."

**Why it matters here:** every avoided round trip is one less database query and one less request the VPS's single Node process has to handle — this is the most direct energy saving available.

---

## 6. Virtualize Long Lists

**Prompt:**

"Find every place in this app that renders a list, table, or grid where the number of items can realistically grow past roughly 50–100 rows — lead lists, review lists, campaign recipient lists, audit results. For each one, replace rendering every row directly with a virtualization approach so only the rows currently visible in the viewport (plus a small buffer) are mounted in the DOM at any time. Use `react-window` rather than `react-virtualized` — it's the smaller, lighter-weight option of the two and is enough for simple fixed or variable row-height lists, which covers everything in this app. Keep the row component passed to the virtualizer as simple as possible; if a row is itself a large component, apply the component-splitting from an earlier step first so the virtualized row stays cheap to mount and unmount as the user scrolls. Confirm scrolling stays smooth and that the total number of DOM nodes for a 1,000-row list stays roughly constant regardless of list length, rather than growing with the data."

**Why it matters here:** rendering thousands of DOM nodes is a client-side cost, but the underlying API/database query behind that list also gets called less aggressively once pagination and virtualization work together, easing load on the VPS's database connection pool.

---

## 7. Stop Unnecessary Re-Renders

**Prompt:**

"Profile the dashboard and any other data-heavy screen in this app using React DevTools' render highlighting to find components that re-render when the props or state they actually depend on haven't changed. For pure presentational components that receive the same props repeatedly during a parent's re-render (chart cards, table rows, list items, small stat widgets), wrap them in React.memo with a shallow prop comparison. Where a component computes something moderately expensive from props or state on every render (sorting a list, filtering a large array, computing derived scores or totals), wrap that computation in useMemo so it only re-runs when its actual dependencies change. Where a component passes callback functions down to memoized children as props, wrap those callbacks in useCallback so a new function identity isn't created on every parent render, which would otherwise defeat the memoization on the child. Do not apply memo/useMemo/useCallback blindly everywhere — only apply them where profiling actually shows a re-render or a recomputation that doesn't need to happen, since the memoization machinery itself has a small overhead and applying it to trivial, cheap components can make things slightly worse rather than better. After each round of memoization, re-profile and confirm the number of re-renders for a typical dashboard interaction (like moving a slider in settings) has measurably dropped."

**Why it matters here:** this is a client-side, browser-CPU optimization more than a server one — but it also means all the calculation work stays where it belongs (the visitor's browser) instead of tempting anyone to move it server-side "to make the UI faster," which would load the VPS instead.

---

## 8. Stop Storing Derived Data In State

**Prompt:**

"Search this codebase for any useState (or Zustand store field) that holds a value which is actually just a computation from other state or props — totals, filtered lists, formatted strings, booleans like 'isValid' or 'hasErrors' that are computed from other fields, sorted copies of arrays that already exist elsewhere in state. For each one, remove it as a stored value and instead compute it inline during render, wrapped in useMemo only if the computation is non-trivial (per the previous prompt's rule of only memoizing where it's actually expensive). Update any code that was manually keeping this derived value in sync via a useEffect that watches the source state and calls setState — that whole effect should be deleted, since the value is now derived automatically every render instead of manually kept in sync. Pay particular attention to the settings and pricing calculators in this app, since threshold and pricing math is exactly the kind of logic that should be a pure computed value, not a separately-tracked state field that has to be manually kept up to date."

**Why it matters here:** derived-in-state patterns tend to spawn extra useEffects that call setState, which causes extra render passes — removing them directly reduces client-side render cycles.

---

## 9. Database Patterns — Scaled Down for a Single Small VPS

**Prompt:**

"Review the Prisma schema and every database query in this app and apply the following patterns, adapted for a single-instance Postgres/SQLite database running on the same small VPS as the app, with no separate database server or replica available:

Add database indexes on every column that's used in a WHERE clause, an ORDER BY, or a JOIN condition in the app's queries — check the leads, reviews, and campaigns tables in particular, since those are the ones likely to be filtered and sorted most often. Use Prisma's `@@index` and `@unique` attributes directly in the schema rather than raw SQL migrations, so indexes stay tracked in source control.

Apply an application-level cache pattern only where it doesn't require a separate cache server: for reference data that changes rarely (service pricing tiers, scoring weight defaults, category multipliers), read it once per server process lifetime and keep it in a simple in-memory module-level cache with a manual invalidation function called from the settings-save handler, rather than querying the database on every request. Do not introduce Redis or any external cache store for this — a single Node process's own memory is enough at this scale and costs nothing extra to run.

Skip the read-replica pattern entirely — a read replica needs a second database instance, which defeats the goal of running on one small VPS. If read load ever becomes a real bottleneck, the correct next step at this scale is better indexing and query-level caching first, not a second database server.

Use UUIDs (or Prisma's `cuid()`) as primary keys instead of auto-incrementing integers wherever a record could ever be referenced externally (in URLs, in emails, in webhook payloads, in exported reports) so IDs aren't guessable or sequential, but keep using regular integer auto-increment IDs for purely internal join/pivot tables where nothing ever references the ID outside the database, since UUIDs take more storage and index space than integers — a small savings, but one that adds up in a resource-constrained setup.

Check for N+1 query patterns anywhere the app loops over a list and queries the database once per item (for example fetching a lead and then separately fetching its reviews one by one) and replace each one with a single query using Prisma's `include` or `select` to fetch related data in one round trip."

**Why it matters here:** the app's single VPS is also running the database — every avoided round trip and every added index directly reduces disk I/O and CPU on the same box serving the frontend.

---

## 10. useReducer for Complex Local State

**Prompt:**

"Find every component in this app that manages a cluster of related state values with several setState calls that always change together in response to the same actions (for example a multi-step form, the campaign builder, or the audit configuration screen where toggling one option often needs to update several related fields at once). Replace these with a single useReducer whose actions describe what happened in plain terms (like 'FIELD_CHANGED', 'STEP_ADVANCED', 'RESET') rather than a pile of individual useState calls and inline update logic scattered through event handlers. Keep the reducer function itself as a plain, dependency-free function so it's easy to unit test in isolation. Only convert a component to useReducer where the state transitions are genuinely interdependent — a component with two or three unrelated independent booleans doesn't need this and should keep plain useState, since useReducer adds a small amount of indirection that isn't worth it for simple cases."

---

## 11. Higher-Order Components — Use Sparingly, Prefer Hooks

**Prompt:**

"Look for any place in this codebase that already uses (or that a code review might suggest adding) a higher-order component to share cross-cutting behavior like requiring authentication, injecting a common set of props, or wrapping a component in a provider. Where the shared behavior is really about accessing some value or triggering a side effect, prefer a custom hook over a new HOC, since hooks compose more simply and don't add extra wrapper components to the React tree — every extra wrapper is a small but real cost multiplied across the app. Reserve the HOC pattern only for cases where the cross-cutting concern genuinely needs to control what gets rendered at all (an auth gate that renders a redirect instead of the wrapped component being the clearest example) rather than for anything that could be expressed as a hook the component calls itself."

---

## 12. Lazy-Load What Isn't Needed Immediately

**Prompt:**

"Identify every route, modal, and heavy component in this app that isn't needed on first paint — settings panels, the campaign provider credentials form, charts and visualizations below the fold, any modal or dialog that only opens on user action, and any admin-only screens. Convert each of these to a dynamically imported component using Next.js's built-in dynamic import with a lightweight loading fallback, so their JavaScript is only downloaded and parsed when the user actually navigates to or opens them, rather than being bundled into the initial page load. Do this especially for any component that pulls in a sizeable dependency (a charting library, a rich text editor, a date picker library) so that dependency's cost is only paid by users who actually use that feature. Verify with the Next.js build output that the initial First Load JS for the main dashboard route has gone down after applying this, and that no unrelated heavy dependency is being pulled into the main bundle anymore."

**Why it matters here:** a smaller initial bundle means less data the VPS has to serve per page load and less parsing/compile work for every visitor — this is one of the few optimizations here that directly reduces server bandwidth, not just client CPU.

---

## 13. Container & Presentational Component Pattern

**Prompt:**

"For the data-heavy screens in this app (dashboard, review management, campaign builder), separate each into a container component and one or more presentational components: the container's only job is to call the data-fetching hooks from earlier prompts, read from the Zustand store or context, and pass plain, already-shaped data and callback props down; the presentational components receive only props, contain no data-fetching or global-state access of their own, and are easy to reuse or restyle without touching any data logic. This isn't a strict rule to apply to every tiny component — trivial components that are pure markup with a couple of props don't need to be split further — but it should be the default shape for any screen-level component that currently mixes 'get the data' and 'render the data' in the same file."

---

## 14. Extra Small-VPS Masterclass Additions

These aren't from the original list but matter just as much for keeping one small VPS healthy long-term. Each is written as a standalone prompt you can run independently.

**14.1 — Single Prisma Client Instance**

"Check whether this app creates a new PrismaClient instance anywhere other than one shared, singleton module. In development with hot reload especially, multiple PrismaClient instances can each open their own database connection pool and quickly exhaust the small number of connections a small VPS's database can comfortably handle. Create exactly one shared Prisma client instance, guarded against being recreated on hot reload in development, and import that single instance everywhere the app talks to the database. Set the connection pool size explicitly to a small number appropriate for a single small VPS (a handful of connections, not the default which can be too high for a low-resource box) via the database connection string's pool settings."

**14.2 — Keep the Production Server Lean and Single-Instance**

"Confirm the production start script runs Next.js in standalone output mode rather than the full `next start`, since standalone mode produces a much smaller self-contained server bundle with only the dependencies actually needed at runtime, which reduces both disk footprint and Node's startup memory. Run exactly one Node process for the app (no cluster mode, no multiple workers) unless the VPS genuinely has multiple cores to spare after the database and any other services are accounted for — extra worker processes each carry their own base memory cost that adds up quickly on a small box. If a process manager is used to keep the app alive and restart it on crash, configure it with a memory limit so a leak triggers a clean restart rather than the process slowly consuming all available RAM."

**14.3 — Compress and Right-Size Images and Static Assets**

"Audit every image used in this app and confirm it's served through Next.js's built-in image optimization rather than as a raw unoptimized file, so images are resized and compressed to the dimensions they're actually displayed at rather than shipping a full-resolution source file to every visitor. Set a reasonable cache lifetime on optimized images and other static assets (fonts, icons) so returning visitors don't force the VPS to regenerate or re-serve them on every visit."

**14.4 — Rate-Limit and Debounce Anything User-Triggered**

"Find every input or control in this app that triggers a network request as the user types or interacts rapidly (search boxes, sliders like the pricing and threshold controls, filters) and add debouncing so a request only fires after the user has paused, not on every keystroke or every pixel of slider movement. On the API side, add a light rate limit to any publicly reachable endpoint (particularly anything unauthenticated, like a sign-in attempt or a public form submission) using a simple in-memory or database-backed counter rather than an external rate-limiting service, since a small VPS is more vulnerable to being overwhelmed by either abusive traffic or an accidental retry loop in the frontend."

**14.5 — Avoid Background Polling; Prefer On-Demand Refresh**

"Check whether any part of this app polls an endpoint on an interval (a `setInterval` calling a query, or a query configured with a refetch interval) to keep data 'live'. Unless a screen genuinely needs near-real-time updates while actively open, remove interval-based polling and instead refetch only when the user returns to the tab (refetch-on-focus, used sparingly) or take an explicit manual refresh action. Where live updates truly matter for one specific screen, keep the interval as long as the use case allows (30–60 seconds rather than every few seconds) so the VPS isn't handling a steady stream of unnecessary requests from every open tab."

**14.6 — Move Heavy Build Work Off the VPS**

"Confirm the production build (`next build`) runs in CI (GitHub Actions or similar) rather than directly on the VPS, and that only the finished build output is deployed to the server. Building on the VPS itself is one of the most CPU- and memory-intensive things that can happen on a small box, and running it there risks the app becoming briefly unresponsive to real traffic during every deploy. If CI isn't set up yet, add a simple pipeline that builds the app on every push to the deploy branch and only copies the compiled `.next` output (or standalone bundle) to the VPS, restarting the process manager afterward."

**14.7 — Log Modestly**

"Review logging throughout the app (console.log, any logging library) and reduce verbose or repeated logs in production, especially anything logging on every request or every render. Ensure logs are rotated or capped in size on disk so verbose logging over time can't slowly fill the VPS's limited disk space, and keep debug-level logs behind an environment flag that's off by default in production."

---

## How to Use This Pack

Run the prompts in order, section by section, reviewing the diff after each one before moving to the next — later prompts assume the earlier structural changes (context split, component split, query layer) are already in place. After finishing all of them, do one final pass: start the app in production mode on the VPS itself, watch memory and CPU at idle and under a light simulated load (a handful of concurrent requests), and confirm both stay flat rather than climbing — that's the real test that everything above actually achieved its goal rather than just moved the same cost somewhere else.
