# CreativeLead — Feature Prompts Pack

This is a set of ready-to-paste prompts (no code) for your coding assistant (Claude Code, Cursor, etc.) to implement the new features into your existing CreativeLead Next.js + Prisma project. Paste each prompt separately, in order, and let the assistant work through your existing codebase (`app/(dashboard)/settings`, `app/(dashboard)/outreach`, `app/api/leads/[id]/outreach`, `prisma/schema.prisma`, etc.).

Your target Google Sheet: `https://docs.google.com/spreadsheets/d/1FwY0ZojQE2JK4zm-yYfou9DVPJey8_4jFRTtyWcK7TE/edit?gid=0#gid=0`

---

## PROMPT 1 — Google Sheets Sync (free method, Google Apps Script Web App)

```
Add a Google Sheets export/sync feature to CreativeLead, using ONLY free tools (no paid Google Cloud API billing). Use the "Apps Script Web App" method:

1. Inside the target Google Sheet (https://docs.google.com/spreadsheets/d/1FwY0ZojQE2JK4zm-yYfou9DVPJey8_4jFRTtyWcK7TE/edit?gid=0#gid=0), create a bound Apps Script project (Extensions > Apps Script) that exposes a doPost(e) web app endpoint. Deploy it as a Web App with access set to "Anyone with the link", and give me the exact step-by-step deployment instructions (menu paths, buttons to click) as part of your output, since this must be deployed manually from the Google UI — there is no paid API key required.

2. The Apps Script must:
   - Accept a JSON payload of one or many lead records via POST.
   - On first run, check row 1 of the target sheet/tab. If row 1 does not already contain the header row below, write it. If it already contains it, leave it untouched.
   - Header row (exact column order), matching what already exists in row 1:
     Company | Website | Email | Phone | LinkedIn | Facebook | Instagram | TikTok | YouTube | Industry | Country | Score | Opportunity | Priority | Status | Next Action | Last Updated
   - Append every new lead as a NEW row starting at row 2 (never overwrite row 1). If a lead already exists in the sheet (match by Company + Website, or a hidden Lead ID column if you add one), UPDATE that existing row instead of duplicating it.
   - Return a JSON response indicating success/failure and how many rows were inserted/updated.

3. In the CreativeLead app itself (Next.js), add:
   - A new Settings tab/section called "Google Sheets Integration" where the user pastes the Apps Script Web App URL (the deployed /exec URL) and clicks "Test Connection" and "Sync Now".
   - A server-side API route that takes lead data from the CreativeLead database (Pipeline/leads) and POSTs it to the stored Apps Script Web App URL in the exact column shape above.
   - A "Sync to Google Sheets" action available from the Pipeline/lead list (bulk sync all leads, or sync a single lead after it's updated) and optionally an auto-sync toggle that pushes a lead to the sheet whenever its Status or Priority changes.
   - Store the Web App URL in the database (see Settings persistence prompt below), not in browser localStorage, so it works across devices/sessions.

4. Map CreativeLead's internal lead fields to the sheet columns exactly as follows, and tell me if any of these fields don't currently exist on the Lead/Enrichment model so we can add them:
   - Company → businessName
   - Website → website
   - Email → email / enrichment.emails[0]
   - Phone → phone
   - LinkedIn → enrichment.linkedinUrl
   - Facebook → enrichment.facebookUrl
   - Instagram → enrichment.instagramUrl
   - TikTok → enrichment.tiktokUrl
   - YouTube → enrichment.youtubeUrl
   - Industry → category
   - Country → derive from city/address, or add a Country field if missing
   - Score → ai_score
   - Opportunity → opportunity.recommendedService
   - Priority → derive from classification (Hot/Warm/Cold) or ai_score bucket
   - Status → pipeline stage (_stage)
   - Next Action → next scheduled follow-up note/date if one exists, else blank
   - Last Updated → updatedAt timestamp, formatted human-readable

Do not use the paid Google Sheets REST API with OAuth service accounts — stick to the Apps Script Web App approach since it requires no billing and no OAuth consent screen for the end user.
```

---

## PROMPT 2 — Sheet-side data validation, smart chips & status colors

```
Extend the Apps Script from the previous step (or add a one-time "Format Sheet" function triggerable from a custom menu inside the Google Sheet) so the sheet itself has proper interactive fields, not just plain text:

1. Status column (data validation + colors):
   - Add a dropdown list (Data validation, "List of items") on the Status column for all data rows, with the exact values used by the CRM pipeline stages (e.g. New, Contacted, Qualified, Proposal, Negotiation, Won, Lost).
   - Add conditional formatting rules on the Status column so each value automatically colors the cell background:
     New = gray, Contacted = blue, Qualified = purple, Proposal = orange, Negotiation = yellow, Won = green, Lost = red.
   - Apply the same conditional formatting rule to the whole row (or at least the Company + Status cells) so a changed status is visually obvious when scanning the sheet.

2. Priority column: add a dropdown (data validation list) with values High / Medium / Low, and conditional formatting: High = red text/bold, Medium = orange, Low = gray.

3. Opportunity column: since this holds a recommended service/insight, turn it into Google Sheets "smart chips" behavior where practical — at minimum add data validation with a dropdown of your standard service offerings (Website Build, Website Redesign, SEO Audit, SEO Monthly Retainer, Social Media Setup, Social Media Management, Review Management, Local Citation Cleanup, Full Digital Audit) so reps can quickly tag it, while still allowing free text if nothing matches (use "Show a warning" rather than "Reject input" for validation so free text isn't blocked).

4. Add a checkbox column (native Sheets checkbox, TRUE/FALSE) labeled "Contacted?" or "Reviewed" next to Next Action, so a rep can tick it off manually inside the sheet — this is a manual/manual-only column not written by the sync script (the script must never overwrite a checkbox value a human has already set).

5. Country column: add a dropdown data validation list of country names so entries stay consistent, but again "Show a warning" instead of "Reject input" so an unmapped country doesn't block the row.

6. Make row 1 (headers) frozen and bold, auto-resize all columns, and set the whole data range as a Google Sheets named range or a proper "Table"/Filter view so new synced rows automatically inherit the same validation and conditional formatting rules.

Give me the exact Apps Script functions to paste in (one function per concern: setupStatusValidationAndColors, setupPriorityValidationAndColors, setupOpportunityValidation, setupCheckboxColumn, setupCountryValidation, freezeAndFormatHeader), plus instructions for wiring a custom menu item "CreativeLead > Format Sheet" that runs all of them in sequence.
```

---

## PROMPT 3 — Outreach Messages: add a Phone Call Script generator

```
In the existing Outreach Generator (app/(dashboard)/outreach and the underlying /api/leads/[id]/outreach route), add a new channel: Phone Call Script.

1. Add a new channel entry alongside the existing ones (Cold Email, LinkedIn Message, WhatsApp Message, Proposal Introduction) with key "phoneScript", label "Phone Call Script", requiresSubject: false.

2. Its generation instruction (the prompt sent to the AI model) should ask for a structured outbound cold-call script with these sections, clearly labeled so the rep can read it live on a call:
   - Opening / Introduction (10-15 seconds, states who you are and why you're calling)
   - Permission-based hook referencing one specific, real detected gap or positive signal about the business (never a fabricated issue)
   - 2-3 short discovery questions to qualify the prospect and uncover pain points
   - A brief value proposition tied to the recommended service
   - Objection-handling notes for the 2 most likely objections (e.g. "we already have someone for that", "not interested", "send me an email instead") with a one-line response to each
   - A clear call to action / next step (e.g. book a 15-minute call, send a proposal)
   - Tone: confident, conversational, respectful of the business owner's time — written the way a real person would speak on the phone, not like an email.

3. Reuse the existing lead-context builder (business name, category, city, rating, review count, detected gaps, positive signals, recommended service) exactly as it's already assembled for the other channels, so the phone script is grounded in real data and never invents details.

4. Update the outreach UI (both the full Outreach Generator page and the per-lead "Outreach Messages" panel inside the lead detail modal) to show Phone Call Script as one more card in the message list, with the same Edit / Regenerate / Copy actions the other channels already have. Persist it the same way (OutreachMessage table, upsert keyed by leadId + channel = "phoneScript"), respecting the existing "editedByHuman" lock so a human-edited script is never silently overwritten by a regeneration.

5. Include it in the "Generate All" / "Regenerate All" bulk action alongside email/linkedin/whatsapp/proposalIntro.
```

---

## PROMPT 4 — Settings page: tabs + unsaved-changes Save/Discard prompt

```
Restructure the Settings page (app/(dashboard)/settings) from one long scrolling page into a tabbed layout, and add unsaved-changes protection.

1. Tabs (left sidebar or top tab bar, your choice of pattern matching the rest of the app's style):
   - AI Provider (existing AI Provider card: provider select, API key, model select, Test Connection)
   - Contact Enrichment (existing card)
   - Scoring Algorithm (existing weights card — see the separate Scoring Algorithm prompt below for the chip-based rework)
   - Opportunity Thresholds (existing card)
   - Service Pricing (existing pricing table card)
   - Campaign Providers (existing Email/Twilio card — see the separate Campaign Providers prompt below for Gmail/Resend additions)
   - Google Sheets (new tab from Prompt 1 above)

2. Unsaved changes tracking:
   - Keep a single "dirty" flag/state that becomes true the instant ANY field on ANY tab changes from its last-saved value (you already have most of the individual onChange handlers — wire them all to also flip this dirty flag, and reset it to false right after a successful save).
   - If the user tries to switch tabs, navigate to a different page in the app (e.g. clicking Pipeline/Outreach/Import in the navbar), or close/reload the browser tab while the dirty flag is true, intercept that action and show a confirmation modal/popup with three options: "Save changes", "Discard changes", "Cancel" (stay on the page). Use the browser's beforeunload event for the reload/close case, and a router-level guard (or a wrapping confirmation check on each nav link's onClick) for in-app navigation.
   - "Save changes" should call the existing save logic then proceed with the navigation the user originally requested.
   - "Discard changes" should revert all fields to the last-saved values (refetch from the settings API/DB) then proceed with navigation.
   - Keep the existing single "Save Settings" button, but make it sticky/visible across all tabs (e.g. pinned in a footer bar) rather than only at the very bottom of one long page, since tabs will hide most sections at any given time. Show the same "✓ Saved successfully" confirmation you already show today.

3. Make sure switching tabs never loses in-progress edits on a tab that hasn't been saved yet (keep all tab state mounted, or hold it in a single parent state object) — only the confirmation modal above should ever discard changes, never a plain tab switch.
```

---

## PROMPT 5 — OpenRouter with DeepSeek free model, saved to DB

```
In the AI Provider settings and the underlying outreach/enrichment/scoring AI calls, make sure OpenRouter is fully wired with the free DeepSeek model as a first-class option:

1. In the AI Provider dropdown, OpenRouter already exists as an option — confirm its api base is https://openrouter.ai/api/v1 (already used in the outreach call helper) and its model list includes at least: deepseek/deepseek-chat (free), deepseek/deepseek-r1 (free) — label them clearly with "(free)" the same way the existing Gemini free models are labeled, and set one of them as the default preselected model whenever the user picks OpenRouter as the provider (so a new user gets a working free setup with zero guesswork).

2. Confirm/keep the existing required headers for OpenRouter calls (HTTP-Referer and X-Title) exactly as already implemented in the outreach generation route, and reuse that same call helper for enrichment estimates and AI scoring insights so OpenRouter+DeepSeek works everywhere the app calls an LLM, not just outreach.

3. Keep the existing "Test Connection" button working for OpenRouter the same way it already works for the other providers (send a minimal "reply with OK" test prompt and show a clear success/error message, including surfacing OpenRouter-specific error codes like 401/429 with the same friendly messages pattern already used for Gemini/Groq/etc).

4. Make sure the OpenRouter API key field is a masked/password input like the other provider keys, and — per the persistence prompt below — is saved to the database, not just browser memory/localStorage, so it survives across sessions and devices.
```

---

## PROMPT 6 — Scoring Algorithm: independent chip-based scoring builder (max 100)

```
Replace the current "Scoring Algorithm (Weights)" sliders section in Settings with a chip-based scoring builder:

1. Show a palette of selectable "scoring factor" chips, each representing one independent, granular signal instead of the current 6 broad weight categories. Break the existing categories down into individual chips, for example:
   - Missing Website
   - Outdated Website Technology
   - Poor Social Media Presence
   - Unclaimed Business Profiles
   - Mobile Responsiveness Issues
   - Slow Page Load Speed
   - Accessibility Issues
   - Missing SEO Basics (title/meta/H1)
   - Poor Local Search / Maps Presence
   - Low Review Count
   - Sub-4.0 Star Rating
   - No Analytics Installed
   - No Live Chat / Chatbot
   - High-Ticket Business Category
   (Feel free to propose 2-3 more you find useful based on what the app's website-intelligence analyzer already detects, listing them by name so I can confirm before you build them in.)

2. Clicking an unselected chip moves it from the "available" palette into an "active scoring list" and reveals a small number input next to it (defaulting to something reasonable like 5 or 10) where the user types the point value that factor contributes to the overall AI Score out of 100.

3. Keep a running total of all active chips' point values, shown prominently (e.g. "72 / 100 used").

4. The moment the running total reaches exactly 100:
   - Disable the ability to add any more chips from the palette (gray them out / make them unclickable, with a tooltip like "Score is fully allocated — remove or lower another factor first").
   - Disable/lock the number inputs on active chips from being increased further (they can still be decreased, which should re-enable adding chips again).
   - Show a small confirmation popup/toast the moment the 100 threshold is hit, e.g. "Nice — your scoring model is fully allocated at 100 points. Remove or reduce a factor to make changes."
   - If the user tries to type a number that would push the total over 100, block that specific change, revert the input to the highest value that keeps the total at or under 100, and show the same popup.

5. Clicking an active chip's "×" removes it from the active list, returns it to the available palette, and frees up its points toward the 100 total (re-enabling further additions if you were previously at 100).

6. This chip configuration replaces the current 6 sliders as the source of truth for the ai_score calculation — update the scoring function so it sums the active chips' point values based on whether each factor is actually detected for a given lead (reuse the existing detection logic already used for opportunity gaps/website intelligence wherever a chip maps to something already detected, e.g. "Missing Website" maps to !website, "Slow Page Load Speed" maps to the existing performance.loadTimeMs threshold, etc.) rather than the old broad category weights.

7. Persist the active chip list and each chip's point value to the database as part of settings (see persistence prompt), not just in-memory, so the model survives reloads and other sessions.
```

---

## PROMPT 7 — Campaign Provider Credentials: Gmail + Resend

```
Expand the existing "Campaign Provider Credentials" settings card so email sending can be configured through Gmail or Resend, in addition to the existing generic SMTP/SendGrid fields:

1. Add a "Provider" selector at the top of the Email section with options: SMTP / SendGrid (existing default, keep all current fields working exactly as they are), Gmail, Resend.

2. Gmail option:
   - Add fields for: Gmail address (From Email), and either an App Password (simplest, free, no OAuth) or, if you prefer full OAuth, a "Connect Gmail" button that runs an OAuth2 flow and stores the resulting refresh token — pick the App Password approach first since it requires no Google Cloud project/OAuth consent screen and is genuinely free; mention the OAuth path as a possible future upgrade rather than building both right now.
   - Show a short inline help note: "Use a Gmail App Password (Google Account > Security > 2-Step Verification > App Passwords), not your regular Gmail password."
   - Under the hood, send mail via Gmail's SMTP (smtp.gmail.com, port 465/587) using the stored address + app password, reusing the same "send email" abstraction the app already has for SMTP/SendGrid so campaigns work identically regardless of which provider is selected.

3. Resend option:
   - Add a single "Resend API Key" field (password input) and keep the existing From Email / From Name fields shared across all three providers.
   - Send mail via Resend's HTTP API using the stored API key.

4. Whichever provider is selected should be the one actually used when the Campaigns feature sends email — make sure the campaign-sending code path checks providers.emailProvider (new field) and branches to the right implementation (SMTP/SendGrid vs Gmail vs Resend) instead of always assuming raw SMTP.

5. Keep the existing Twilio (SMS & WhatsApp) section exactly as-is below the Email section — no changes needed there.

6. All new fields (provider selector, Gmail address, Gmail app password, Resend API key) must be part of the same settings persistence/save flow as everything else (see persistence prompt below).
```

---

## PROMPT 8 — Persist ALL settings to the database across sessions

```
Audit every field across the Settings page (AI Provider + API keys + model selection, Contact Enrichment key/provider, Scoring Algorithm chip configuration, Opportunity Thresholds, Service Pricing table, Campaign Provider Credentials for SMTP/Gmail/Resend/Twilio, and the new Google Sheets Web App URL) and make sure every single one of them is:

1. Read from the database on page load (via the existing settings API route pattern, e.g. the same one already used for /api/settings/integrations) rather than from browser localStorage or in-memory-only React state that resets on reload.

2. Written to the database as part of the single "Save Settings" action described in the tabs prompt above — one save call that persists the full settings object (or one call per section if that's cleaner, but all must complete before showing "Saved successfully").

3. Add/extend whatever Prisma model is needed (e.g. an OrganizationSettings or AppSettings table, one row per organization, matching the existing org-scoped pattern already used elsewhere in this codebase like organizationId on Lead) to store this as structured JSON or explicit columns — your call on which is cleaner given the existing schema — and run/generate the appropriate Prisma migration.

4. Never store API keys or credentials in localStorage, sessionStorage, or any client-only storage — always round-trip through the server so the same settings show up correctly if the user logs in from a different browser or device.

5. Mask all secret fields (API keys, passwords, tokens) as password inputs in the UI as most already are, and make sure the settings GET endpoint either omits secret values entirely and just returns "isSet: true/false" flags, or returns them masked (e.g. "sk-••••1234") — avoid ever sending the full plaintext secret back down to the client after the initial save unless the user explicitly needs to edit it.

Confirm back to me which approach you took (single JSON blob column vs explicit columns) and whether you added a new Prisma model or extended an existing one, before running any destructive migration.
```

---

### How to use this pack
Paste these prompts one at a time, in order (1 → 8), into Claude Code (or your coding assistant of choice) inside your `creativelead` project folder. Each prompt is self-contained but assumes the previous ones have landed, since later prompts (Settings tabs, persistence) touch the same files as earlier ones (scoring chips, campaign providers). Review the diff after each prompt before moving to the next.
