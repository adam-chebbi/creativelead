# 13 — Browser Extension: In-Page Extraction Overlay for Google Maps

This pack adds a floating control panel that the extension injects
directly into the Google Maps page itself, so an operator can start,
monitor, and stop an extraction session without ever opening the
extension's popup. It builds on top of the sync-based extension already
planned in `.claude/docs/07-browser-extension-roadmap.md` — read that file
first, since this pack does not change the extraction logic, the sync
protocol, or the multi-workspace model, only where the controls live.
Paste these prompts one at a time into your coding agent inside the
`browserextractor/` folder.

---

## 1. Ground rules for this feature

**Prompt:**

"Before implementing the in-page overlay, confirm these constraints with
me and follow them for the rest of this work: the overlay is a content
script injected into `google.com/maps` pages only, never a page the
extension doesn't already have permission for. It must not modify,
remove, or visually interfere with any native Google Maps UI element — it
is an additional floating panel the extension adds, not a replacement for
anything Google renders. It reuses the exact same extraction logic,
per-session lead cap (~100), resume-from-where-you-left-off behavior, and
EN/FR locale support that already exist in the popup version — do not fork
or duplicate the extraction code path; the popup and the in-page overlay
must call the same underlying extraction and sync functions so they can
never drift out of sync with each other. If a session is started from the
overlay, it must show correctly if the user then opens the popup (and vice
versa) — there is one extraction-session state, observed from two possible
UI surfaces, not two independent sessions."

---

## 2. The injected panel itself

**Prompt:**

"Add a content script that, on any Google Maps page, injects a small,
collapsible floating panel positioned so it never overlaps Google's own
search box, results list, or zoom controls (bottom-right corner is a
reasonable default, but confirm it doesn't collide with Maps' own
'report a problem'/zoom UI at common viewport sizes before finalizing
placement). The panel should be visually distinct as belonging to the
extension (its own small header/logo, not styled to imitate Google's own
UI) so a user is never confused about which product they're interacting
with. Give it three states: collapsed (a small pill or icon showing
current status — idle, extracting, paused, synced-N-of-M — that expands
on click), expanded (shows the same controls the popup has today: start,
pause/resume, stop, current count extracted, current workspace selector,
and a link to open full settings), and hidden (a way to dismiss it
entirely for the current tab/session if the user doesn't want it, without
uninstalling the extension or losing extraction state — extraction should
keep running in the background even while the panel is hidden). Persist
the hidden/visible preference per browser profile, not per page load, so
dismissing it once doesn't require re-dismissing it on every new Maps tab
in the same session."

**Why it matters here:** the goal named in the roadmap is authenticated,
resumable sync without extra friction — putting the controls on the page
itself removes the "open the popup, find the right button" step entirely
for the most common action (start/stop/check progress), while the
collapsed/hidden states keep it from being intrusive for anyone who
prefers the existing popup-only flow.

---

## 3. Trigger extraction from the page without the popup

**Prompt:**

"Wire the expanded panel's Start button to trigger the exact same
extraction flow the popup's Start button triggers today — same
permission checks, same workspace/session-token check before it will
run, same per-session cap enforcement, same resume behavior if a prior
session for this tab/search was left unfinished. If no workspace is
selected yet (first-time use, or the stored token has expired), the panel
should show an inline 'Sign in to a workspace' prompt with a button that
opens the extension's existing settings/auth flow in a new tab, rather
than silently failing or trying to build a second, separate auth flow
inside the overlay itself. Once extraction is running, update the panel's
counter and status live as leads are found and synced, using the same
batching/backoff-and-retry behavior against the ingestion endpoint that
`.claude/docs/07-browser-extension-roadmap.md` already specifies — the
overlay is a new place to see and control that behavior, not a new
implementation of it."

**Why it matters here:** the two things that make this genuinely useful —
"don't need to open the extension" and "identical behavior to the
popup" — depend on each other; a second, subtly different extraction path
would be a support and correctness liability, not a convenience.

---

## 4. Respect Google Maps' own page lifecycle

**Prompt:**

"Google Maps is a single-page app that changes search results, pans, and
zooms without a full page reload. Make sure the injected panel survives
these in-page navigations (it should not disappear or reset when the user
pans/zooms/searches again on the same tab), and correctly reflects
'no active session' vs 'session in progress' if the user navigates from a
search-results view to a different one entirely. Also confirm the content
script only injects the panel once per tab even if Maps re-renders its own
DOM (a known SPA behavior) — guard against creating duplicate panels on
DOM mutation events."

**Why it matters here:** Google Maps' route changes without full reloads
are the most likely source of a duplicated or disappearing panel; testing
this explicitly avoids a class of bug that's easy to miss if the overlay
is only tested on a single, static search result page.

---

## 5. Keep it accessible and non-intrusive

**Prompt:**

"Make sure the injected panel is keyboard-navigable (tab order, visible
focus state, Escape to collapse), has appropriate ARIA labeling since it's
injected outside of Google's own accessibility tree, and does not trap
focus or scroll on the underlying Maps page while expanded. Confirm the
panel's z-index and positioning don't break on Maps' own fullscreen mode
or on narrow browser windows — provide a sensible collapsed-by-default
behavior on small viewports rather than a panel that overlaps Maps'
navigation controls."

---

### How to use this pack

Run prompts 1 through 5 in order inside `browserextractor/`. This pack
assumes the sync-based extension work from
`.claude/docs/07-browser-extension-roadmap.md` is either already done or
being done in parallel — if that work hasn't started yet, do it first,
since this pack's Prompt 3 explicitly reuses that sync/auth/session
behavior rather than building it again.
