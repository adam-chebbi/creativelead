# AutoReach V2 — Full Architecture Prompt Pack

> **Purpose:** This document is a complete prompt-by-prompt specification for building the next version of AutoReach. It covers the SaaS frontend, the desktop worker (Electron or Tauri), the API bridge, and the human-like browser scraping engine. Each section is written as a prompt you hand directly to an AI coding assistant.

---

## Table of Contents

1. Project Vision & Architecture Overview
2. SaaS Frontend — Next.js Web App
3. Authentication & User Management
4. API Server — Worker Bridge
5. Desktop Worker — Electron App Shell
6. Desktop Worker — Tauri App Shell (Alternative)
7. Human-Like Browser Scraping Engine
8. Google Maps Scraping — Search & Results
9. Google Maps Scraping — Business Detail Page
10. Google Maps Scraping — Reviews Extraction (50 most recent)
11. Data Sync — Worker to SaaS Dashboard
12. Real-Time Scraping Visibility (Live Browser Window)
13. Dashboard — Leads & Results View
14. Dashboard — Pipeline & CRM
15. Email Outreach Module (Existing AutoReach Logic)
16. Follow-Up Automation
17. Worker Auto-Update System
18. Security & API Key Management
19. Database Schema (Full)
20. Deployment Prompts

---

## 1. Project Vision & Architecture Overview

### Prompt 1.1 — System Architecture Brief

You are building AutoReach V2, a lead generation SaaS platform with the following architecture. There are four distinct layers that must work together.

The first layer is the SaaS web dashboard, a Next.js application hosted in the cloud. This is where users sign up, manage their account, view scraped leads, run outreach campaigns, and monitor their pipeline. Users never run scraping from this layer directly.

The second layer is the desktop worker, a downloadable application built with Electron (or Tauri as an alternative). The user downloads and installs this on their own Windows, Mac, or Linux machine. The worker is the scraping engine. It uses the user's own computer, the user's own internet connection, and the user's own default browser to perform all scraping. This is critical — the scraping happens on the user's machine, not on any server.

The third layer is the API bridge, a REST API (Node.js with Express or a Python FastAPI service) that acts as the communication layer between the desktop worker and the SaaS dashboard. The worker authenticates with this API using a secure token tied to the user's account. The worker sends scraped data to the API. The API stores data in the database and makes it available to the SaaS dashboard.

The fourth layer is the database, a PostgreSQL instance (or Supabase) that stores all user data, scraped leads, email logs, pipeline stages, and worker session information.

The core philosophy of this architecture is that scraping load is distributed across all users' machines. No cloud scraping costs. No proxy costs. No API costs for lead discovery. The user's machine does the heavy lifting; the SaaS just stores and presents results.

Build this system with these constraints in mind at all times. Never suggest server-side scraping. Never suggest paid scraping APIs. Never suggest Google Maps API for lead discovery.

---

### Prompt 1.2 — Technology Stack Decisions

Define the technology stack for AutoReach V2 as follows and do not deviate from these choices unless explicitly instructed.

For the SaaS frontend, use Next.js 14 with the App Router, TypeScript, Tailwind CSS, and shadcn/ui for components. For state management use Zustand. For data fetching use TanStack Query. For real-time updates use Supabase Realtime or Socket.IO depending on the backend choice.

For the API server, use Node.js with Express and TypeScript. Use Prisma as the ORM. Use JWT for worker authentication and NextAuth for user authentication on the web.

For the desktop worker, use Electron with TypeScript as the primary choice. The worker must be cross-platform (Windows, Mac, Linux). It uses Playwright as the browser automation library because Playwright can control the user's existing default browser or launch a visible Chromium instance in non-headless mode. Do not use Puppeteer. Do not use Selenium. Do not use any paid scraping service. Do not use any browser extension injection approach.

For the database, use PostgreSQL via Supabase. This gives a hosted database, built-in authentication, and realtime subscriptions for free on the starter plan.

For email sending, keep the existing Resend API integration from AutoReach V1.

For AI copy generation, keep the existing Groq API integration with LLaMA 3.1.

---

## 2. SaaS Frontend — Next.js Web App

### Prompt 2.1 — Project Scaffold

Create a new Next.js 14 project using the App Router with TypeScript and Tailwind CSS enabled. Set up the following folder structure inside the app directory. Create a marketing folder for public-facing pages including a landing page, a pricing page, and a features page. Create a dashboard folder for authenticated pages including an overview page, a leads page, a pipeline page, an outreach page, a reports page, and a settings page. Create an auth folder containing a login page and a signup page. Create a download page at the root level.

Set up a components folder at the project root containing a ui subfolder (for shadcn components), a layout subfolder (for nav, sidebar, footer), a dashboard subfolder (for dashboard-specific widgets), and a scraper subfolder (for scraping status and live feed components).

Set up a lib folder containing an api file for API client functions, a supabase file for the Supabase client, an auth file for session helpers, and a types file for shared TypeScript interfaces.

Install shadcn/ui and initialize it with a neutral color palette and dark mode support. Install TanStack Query, Zustand, and the Supabase JavaScript client.

Do not write any page content yet. Only set up the structure and configuration files.

---

### Prompt 2.2 — Landing Page

Build the marketing landing page for AutoReach V2. The page must communicate the following value proposition clearly.

AutoReach finds local business leads for you automatically. You install a small desktop app, point it at any city and business type, and it opens Google Maps, searches, scrolls, and collects every business it finds — including contact details and recent reviews — while you watch it work. All results sync instantly to your dashboard where you can manage your pipeline and send AI-personalised outreach emails.

The page should have a hero section with a headline, a subheadline, a primary call-to-action button labeled "Download the Worker — it's free" and a secondary button labeled "View Dashboard". Below the hero show three feature cards. The first card describes automatic lead discovery from Google Maps with no API costs. The second card describes the live browser window where the user can watch the scraper navigate in real time. The third card describes the AI email outreach and automated follow-up system.

Add a "How it works" section with four numbered steps. Step one: create an account and download the worker app. Step two: open the worker, enter a city and business type, and click start. Step three: watch the browser open Google Maps and collect leads automatically. Step four: manage your leads and send personalised emails from the dashboard.

Add a simple pricing section with a free tier (100 leads per month, 1 active campaign) and a pro tier (unlimited leads, unlimited campaigns, AI outreach, follow-up automation). Use placeholder prices.

Add a footer with links to terms, privacy, and contact.

---

### Prompt 2.3 — Download Page

Build the download page at the route /download. This page is shown to authenticated users after signup. It should detect the user's operating system using the browser's user agent string and automatically highlight the correct download button.

Show three download buttons: one for Windows (.exe installer), one for macOS (.dmg), and one for Linux (.AppImage). Each button should show the file size placeholder and a version number placeholder.

Below the download buttons, show a three-step setup guide. Step one: download and install the worker for your operating system. Step two: open the worker application. It will ask you to paste your worker token. Step three: copy your worker token from the box shown on this page and paste it into the worker. Click connect.

Show the user's unique worker token in a code-style box with a copy button. This token is generated per user account and is how the worker authenticates with the API. Add a note explaining that this token is secret and should never be shared.

Add a "Your connected workers" section below that shows a table of all worker sessions linked to this account, including the machine name, operating system, last seen timestamp, and current status (online or offline).

---

### Prompt 2.4 — Dashboard Overview Page

Build the authenticated dashboard overview page at /dashboard. This page requires authentication. If the user is not logged in, redirect to /auth/login.

The page layout should use a persistent left sidebar with navigation links to Overview, Leads, Pipeline, Outreach, Reports, Settings, and Download Worker. The sidebar should show the user's name and avatar at the bottom with a logout button.

The overview page main content should show four metric cards at the top. The first shows total leads collected. The second shows leads with emails found. The third shows emails sent this month. The fourth shows pipeline stage breakdown as a small bar.

Below the metric cards show a "Worker Status" panel. If no worker is connected, show a prompt card explaining that the user needs to download and connect the desktop worker to start collecting leads, with a link to the download page. If a worker is connected, show the worker's machine name, status as "Online", and the current scraping session if one is active.

Below the worker status show a "Recent Leads" table with the last 10 leads collected, showing name, address, phone, website, email, and the time they were collected.

Below that show a "Recent Activity" feed showing timestamped events like "Worker connected from MacBook Pro", "Scraping session started — Coffee Shops in Tunis", "47 leads collected", "Email sent to Al Baraka Café".

---

## 3. Authentication & User Management

### Prompt 3.1 — NextAuth Setup with Supabase

Set up NextAuth in the Next.js project using the Supabase adapter. Configure the following providers: email and password (credentials provider), Google OAuth, and GitHub OAuth.

For the credentials provider, validate the email and password against the Supabase users table. Hash passwords with bcrypt before storing. On successful login, return a session object containing the user's id, email, name, and their worker token.

Create a Supabase users table with the following columns: id as a UUID primary key with a default of gen_random_uuid(), email as unique text not null, password_hash as text nullable (null for OAuth users), name as text, avatar_url as text, worker_token as unique text generated on account creation, plan as text defaulting to 'free', created_at as a timestamp defaulting to now(), and last_seen as a timestamp.

Generate the worker_token on account creation as a cryptographically random 32-byte hex string using Node.js crypto.randomBytes. This token never changes unless the user explicitly regenerates it from settings.

Create the NextAuth configuration at app/api/auth/[...nextauth]/route.ts. Set up session strategy as JWT. Add callbacks to include the worker_token in the JWT and session so the download page can display it.

Create a middleware file at the project root that protects all routes under /dashboard and /download, redirecting unauthenticated users to /auth/login.

---

### Prompt 3.2 — API Worker Authentication

In the Express API server, build a worker authentication middleware. This middleware reads the Authorization header, expects a value in the format "Bearer WORKER_TOKEN", looks up the token in the users table, and attaches the user record to the request object. If the token is missing or invalid, return a 401 JSON response.

This middleware must be applied to all worker-facing API routes. It must also update the user's last_seen timestamp and log a worker_sessions record every time a new connection is made (detecting new sessions by comparing the machine_name and platform fields sent in the request headers).

Create a worker_sessions table with columns: id, user_id as a foreign key, machine_name as text, platform as text (windows, macos, linux), worker_version as text, connected_at as timestamp, last_ping as timestamp, and status as text (online, offline).

The worker must send a heartbeat ping to POST /api/worker/ping every 30 seconds while it is running. If no ping is received for 90 seconds, the session status should be automatically set to offline via a background job or a status check on read.

---

## 4. API Server — Worker Bridge

### Prompt 4.1 — Express API Server Setup

Create a standalone Express API server using TypeScript. This server is separate from the Next.js app and runs as its own process. It will be deployed independently (for example on Railway or Render).

Set up the server with the following route groups. All routes under /api/worker are for the desktop worker and require the worker token authentication middleware. All routes under /api/dashboard are for the Next.js frontend and require a different middleware that validates the NextAuth JWT session.

Create the following worker routes as empty stubs that return 200 with a placeholder body. POST /api/worker/ping for heartbeat. POST /api/worker/session/start for starting a scraping session. POST /api/worker/session/end for ending a scraping session. POST /api/worker/leads for bulk-uploading scraped leads. POST /api/worker/lead/:id/reviews for uploading reviews for a specific lead. GET /api/worker/config for fetching the current scraping configuration set by the user on the dashboard.

Create the following dashboard routes as stubs. GET /api/dashboard/leads for fetching the user's leads with pagination and filters. GET /api/dashboard/stats for fetching overview statistics. GET /api/dashboard/sessions for fetching worker session history. GET /api/dashboard/pipeline for fetching pipeline data grouped by stage.

Set up Prisma with a PostgreSQL connection string from environment variables. Run prisma init and create the initial schema file with all tables defined.

Set up CORS to allow requests from the Next.js app domain and reject all others. Set up rate limiting using express-rate-limit to prevent abuse of the worker upload endpoints.

---

### Prompt 4.2 — Lead Upload Endpoint

Build the POST /api/worker/leads endpoint in detail. This endpoint receives an array of lead objects from the desktop worker and saves them to the database.

Each lead object in the request body must have the following shape. A name field as a string. An address field as a string. A phone field as a string that may be empty. A website field as a string that may be empty. An email field as a string that may be empty. A google_maps_url field as the full URL of the business's Google Maps listing. A rating field as a decimal number or null. A review_count field as an integer or null. A category field describing the business type as returned by Google Maps. A latitude field as a decimal number or null. A longitude field as a decimal number or null. A session_id field linking this lead to the scraping session that found it.

The endpoint must deduplicate leads by comparing the combination of user_id and google_maps_url. If a lead with the same URL already exists for this user, update the existing record rather than inserting a duplicate. This is an upsert operation.

After saving, return a summary response showing how many leads were inserted, how many were updated, and how many were skipped.

Also emit a realtime event via Supabase Realtime or a Socket.IO broadcast so the dashboard can update its lead count live without the user needing to refresh the page.

---

### Prompt 4.3 — Reviews Upload Endpoint

Build the POST /api/worker/lead/:id/reviews endpoint. The :id parameter is the lead's database ID. The request body contains an array of review objects, maximum 50.

Each review object must have the following fields. An author_name field as a string. A rating field as an integer between 1 and 5. A text field as a string containing the review body, which may be empty for rating-only reviews. A published_at field as a string representing the relative time as shown on Google Maps, for example "3 months ago" or "a week ago", because Google Maps does not expose exact dates in its public-facing interface. A author_image_url field as a string or null.

Before inserting reviews, delete all existing reviews for this lead_id to ensure the stored reviews always reflect the most recent 50. This is intentional — the worker always fetches the 50 most recent reviews and replaces whatever was stored before.

Return a count of how many reviews were saved.

---

### Prompt 4.4 — Scraping Configuration Endpoint

Build the GET /api/worker/config endpoint. This returns the scraping configuration that the user has set on the dashboard, which tells the worker what to scrape.

The configuration object must include the following fields. A jobs array where each item has a city string, a business_type string, a max_results integer defaulting to 200, a scrape_reviews boolean, and a status string that can be "pending", "running", "completed", or "paused". A settings object with a scroll_delay_min integer (milliseconds, minimum time to wait between scroll actions), a scroll_delay_max integer (maximum time), a page_load_wait integer (milliseconds to wait for pages to load), and a results_per_session integer (how many leads to collect before pausing).

The worker polls this endpoint every time it starts a new session and also when the user clicks "Fetch latest config" in the worker UI.

Also build a corresponding PATCH /api/dashboard/config endpoint that the Next.js frontend calls when the user updates their scraping configuration from the dashboard settings page.

---

## 5. Desktop Worker — Electron App Shell

### Prompt 5.1 — Electron Project Setup

Create a new Electron application using TypeScript. Use electron-builder for packaging. The project should use a src/main folder for the Electron main process code and a src/renderer folder for the UI rendered in the Electron window.

For the renderer, use React with TypeScript and Tailwind CSS. The renderer communicates with the main process via contextBridge and ipcRenderer, never via direct Node.js access from the renderer.

The main process is responsible for all Node.js operations including the Playwright scraping engine, the API communication, file system access, and auto-update checks. The renderer is only responsible for displaying status and receiving user input.

Set up electron-builder with targets for Windows (NSIS installer), macOS (DMG), and Linux (AppImage). Configure the build to produce installers in a dist folder.

Set up a preload script that exposes the following functions to the renderer via contextBridge. A function to start a scraping session that takes a job configuration object. A function to stop the current scraping session. A function to fetch the current session status. A function to connect to the API using a worker token. A function to get the connected user's name and plan. Set up listeners for events pushed from the main process to the renderer, including a scraping-progress event, a lead-found event, and an error event.

---

### Prompt 5.2 — Electron Main Window UI

Build the Electron renderer UI using React and Tailwind CSS. The UI is a single window with a clean, minimal dark design.

The window should have four states.

The first state is the connection state, shown when no worker token has been entered. It shows the AutoReach logo, a text input labeled "Paste your Worker Token from the dashboard", a Connect button, and a link that opens the dashboard download page in the default browser.

The second state is the idle state, shown after successful connection. It shows "Connected as [user name]" with a green indicator dot. It shows a "Jobs Waiting" count pulled from the API config. It shows a large "Start Scraping" button. It shows a small log area at the bottom showing the last few activity lines.

The third state is the scraping state, shown while a session is active. It shows a progress bar with current lead count over target. It shows a live feed of recently found businesses appearing as they are scraped, each as a small card showing the business name and address. It shows a "Pause" button and a "Stop" button. It shows a counter for how many leads have been synced to the dashboard so far.

The fourth state is the paused or completed state, shown after a session ends. It shows a summary of how many leads were collected, how many had reviews scraped, and how many were synced. It shows a "Start New Session" button and a "View on Dashboard" button that opens the browser.

The UI must be responsive to window resizing and must look good at a minimum width of 480 pixels.

---

### Prompt 5.3 — Token Storage & Secure Config

In the Electron main process, handle storing the worker token securely. Use the electron-store package to persist the token to disk in the user's application data folder. This means the user only needs to paste their token once.

On application startup, check if a token exists in the store. If it does, immediately attempt to verify it by calling GET /api/worker/ping with the stored token. If the ping succeeds, move to the idle state. If the ping fails (401 or network error), clear the stored token and show the connection state.

Also store the following settings in electron-store: the API base URL (so the app can be pointed at different environments), the user's last-run job configuration, and the worker version string.

Create an IPC handler for a "clear-token" event that clears the stored token and triggers a state reset to the connection screen. This is used when the user clicks "Disconnect" from within the app.

---

## 6. Desktop Worker — Tauri App Shell (Alternative)

### Prompt 6.1 — Tauri Setup as Alternative to Electron

If the team prefers a lighter-weight desktop app with a smaller bundle size, create the worker using Tauri instead of Electron. The following describes the equivalent setup in Tauri.

Use Tauri 2.0 with a React + TypeScript + Tailwind CSS frontend. The Tauri backend is written in Rust. Because the scraping engine must be written in TypeScript using Playwright, the architecture changes slightly. The Tauri app spawns a bundled Node.js child process that runs the scraping engine as a sidecar. The Tauri frontend communicates with the Rust backend via Tauri commands, and the Rust backend communicates with the Node.js sidecar via stdin/stdout IPC.

Configure the Tauri sidecar in tauri.conf.json to bundle the Node.js scraping engine as an external binary. The sidecar binary is compiled using pkg or a similar tool that bundles Node.js and the scraping script into a single executable.

The UI spec is identical to Prompt 5.2. All four states apply equally.

Use the Tauri store plugin for secure credential storage instead of electron-store.

Note to the team: Electron is recommended for faster development because Playwright integration is native. Tauri is recommended if final binary size and memory usage are priorities. Both are valid.

---

## 7. Human-Like Browser Scraping Engine

### Prompt 7.1 — Playwright Setup for Visible Browser Automation

Build the core scraping engine for the desktop worker using Playwright. This engine must open a real, visible browser window on the user's screen. The user must be able to watch every action the scraper takes as it navigates Google Maps, searches for businesses, scrolls through results, and extracts data. This is a core product feature, not optional.

Use Playwright's chromium launch in non-headless mode with the following configuration. Set headless to false. Set slowMo to a value between 40 and 80 milliseconds chosen randomly at session start to make all actions feel measured rather than instant. Set the viewport to a realistic desktop resolution such as 1280 by 800. Set the user agent to the latest stable Chrome user agent string for the operating system the worker is running on.

Do not use any Playwright stealth plugins or anti-detection libraries. Instead, implement human-like behavior manually through the techniques described in the prompts below. The goal is natural-looking navigation, not undetectable automation — these are two different things and the former is sufficient.

Open the browser with an existing user data directory from the Playwright's default profile location so that the browser appears as a regular Chrome session with history rather than a brand-new incognito session. This is important. Use Playwright's userDataDir option pointing to a dedicated "AutoReach Worker" profile that persists between sessions.

---

### Prompt 7.2 — Human-Like Input Simulation

Build a set of utility functions for the scraping engine that simulate human-like interactions. These functions must be used throughout all scraping code. Never use direct Playwright action calls without wrapping them in these utilities.

Build a function called humanType that takes a page object, a selector, and a string of text. This function focuses the element, then types each character one at a time using a random delay between 60 and 180 milliseconds per character. Occasionally (with 15% probability per character) it types an extra wrong character and then immediately presses Backspace to correct it, as humans do when typing quickly.

Build a function called humanClick that takes a page object and a selector. This function moves the mouse to a random point within the element's bounding box (not the center, not a fixed offset — a random point inside the element), waits a random delay between 80 and 200 milliseconds, then clicks. Do not use Playwright's click directly except inside this wrapper.

Build a function called humanScroll that takes a page object, a direction (up or down), and a target distance in pixels. This function performs the scroll in multiple smaller steps of random size between 80 and 200 pixels each, with a random delay of 100 to 400 milliseconds between each step. Occasionally (20% probability) reverse direction slightly by 30 to 60 pixels before continuing in the original direction. This mimics a human who overshoots and corrects.

Build a function called humanWait that takes a minimum and maximum number of milliseconds and returns a promise that resolves after a random duration in that range. Use this instead of any fixed delays throughout the codebase.

Build a function called humanMouseMove that takes a page object and moves the mouse from its current position to a new random position on the page in a curved path with 3 to 5 intermediate waypoints, using Playwright's mouse.move with small step values.

---

### Prompt 7.3 — Session Warm-Up Behavior

Before beginning any scraping work, the engine must perform a session warm-up sequence. This makes the browser session look like a normal user who opened their browser and happened to end up on Google Maps.

The warm-up sequence proceeds as follows.

Open a new browser page. Navigate to google.com first, not directly to maps.google.com. Wait for the page to fully load. If a cookie consent popup appears, click the appropriate "Accept" or "Reject" button. Move the mouse randomly across the page for 2 to 4 seconds using humanMouseMove. With 30% probability, click on a random news headline visible on the Google homepage to simulate casual browsing, then wait 3 to 7 seconds, then press the browser's back button. With 20% probability, type a short random search query into the Google search box using humanType and press Enter, then wait for results, then press back.

After the warm-up, navigate to maps.google.com by typing the URL into the address bar using Playwright's page.goto but with a random delay of 800 to 1500 milliseconds before calling it, to simulate a user deciding to go to Maps.

Wait for the Google Maps interface to fully load by waiting for the search box element to be visible. Emit a status event to the renderer saying "Ready — Google Maps loaded".

---

## 8. Google Maps Scraping — Search & Results

### Prompt 8.1 — Search Query Execution

Build the search execution function for the scraping engine. This function takes a business_type string and a city string and performs a search on Google Maps.

Find the search input element on Google Maps using a reliable selector strategy. Do not use a single fragile selector — instead, try a prioritized list of selectors and use the first one that is found on the page. The selectors to try in order are: an input with the id "searchboxinput", an input with the aria-label containing the word "Search", and any input element inside the element with id "searchbox".

Use humanType to type the search query in the format "business_type in city", for example "coffee shops in Tunis". After typing, wait between 400 and 800 milliseconds using humanWait to simulate a user pausing before pressing Enter. Then press Enter using page.keyboard.press.

Wait for the search results panel to appear. The results panel on Google Maps is a scrollable div on the left side of the screen. Wait for this element to become visible using Playwright's waitForSelector with a timeout of 15 seconds. If the timeout is reached, emit an error event and retry the search once before failing the session.

After the results panel appears, wait an additional humanWait of 1000 to 2000 milliseconds before beginning to extract results, simulating a user reading the first results before scrolling.

Emit a status event to the renderer saying "Search complete — scrolling through results".

---

### Prompt 8.2 — Results Panel Scrolling & Lead Collection

Build the main results collection loop. This is the core of the scraping engine. It scrolls through the Google Maps results panel and extracts each business listing.

The results panel on Google Maps renders results lazily as you scroll — businesses load as they come into view. The scraper must scroll repeatedly and collect new results after each scroll.

Implement the loop as follows.

Initialize an empty set of seen google_maps_urls to avoid collecting the same business twice. Initialize a results array. Set a continue_scrolling flag to true.

While continue_scrolling is true and the results count is below the configured max_results, perform the following steps.

Find all currently visible business listing elements in the results panel. These are typically anchor elements or div elements with a specific data attribute. Do not hardcode a single selector. Instead, look for elements that have an href containing the string "/maps/place/" as these are always the permalink URLs for individual business listings on Google Maps. Extract all such elements from the current page state.

For each found element that is not already in the seen set, extract the basic listing data available without clicking. This includes the business name from the element's text content or aria-label, the rating shown as a number, the review count shown in parentheses, the category label (such as "Coffee shop" or "Restaurant"), and the address snippet if visible. Also extract the full href URL as the google_maps_url and add it to the seen set.

Push each new business as a partial lead object into the results array. Emit a lead-found event to the renderer with the business name and address so the UI can display it in the live feed.

After processing all currently visible results, perform a humanScroll downward on the results panel element with a distance between 400 and 700 pixels. Then call humanWait between 800 and 1800 milliseconds to wait for new results to load.

After waiting, check whether new elements appeared by comparing the seen set size to the count before scrolling. If no new elements appeared after three consecutive scrolls, set continue_scrolling to false — this means you have reached the end of the results for this search.

After the loop ends, return the results array. Emit a status event saying "Results collected — [count] businesses found — beginning detail scraping".

---

### Prompt 8.3 — Handling "No Results" and Map Boundary Cases

Build error handling for edge cases in the search results loop.

When the search returns zero results, Google Maps shows a message that typically contains text similar to "no results" or shows a blank panel. Detect this by checking if the results panel contains no listing elements after a 5-second wait. If this is detected, emit an error event to the renderer with the message "No results found for this search. Try a different business type or city." and end the session gracefully without crashing.

When the search returns results that are geographically spread across a large area (a country-level search rather than a city-level search), Google Maps may show a map-level zoom that requires the user to zoom in. Detect this by checking if any element containing the text "zoom in" or "results in this area" is visible after the search. If detected, emit a warning to the renderer and programmatically click the "Search this area" button if it is visible, or emit guidance to the user to be more specific in their city input.

When Google Maps shows a CAPTCHA or a "prove you're human" screen, immediately pause the scraping session, emit a critical error event to the renderer, and show the user a message saying "Google has shown a CAPTCHA. Please solve it in the browser window, then click Resume in the worker." Implement a resume mechanism where the user can click Resume in the worker UI and the scraper checks whether the CAPTCHA is gone before continuing. If the CAPTCHA appears more than twice in a single session, end the session and suggest the user wait 30 minutes before trying again.

---

## 9. Google Maps Scraping — Business Detail Page

### Prompt 9.1 — Clicking Into Each Business Listing

Build the detail scraping phase. After collecting all business URLs from the results panel, the scraper visits each business's detail page to extract richer information.

For each business URL in the collected results, navigate to the URL using page.goto. Do not click the listing in the panel — navigate directly to the URL. This is more reliable than clicking in the panel which can trigger hover states and popups.

Before navigating, call humanWait between 1200 and 2500 milliseconds. This wait occurs between every single business — it is not optional. Removing this wait will cause the session to look automated and trigger rate limiting from Google.

After navigation, wait for the business detail panel to load. The detail panel contains the business name as a heading, the full address, the phone number, the website link, the rating, the review count, and the category. Wait for the heading element to be visible with a 10-second timeout.

Extract the following fields from the detail panel. The full business name. The formatted address. The phone number — look for an element with a data-item-id attribute containing "phone" or look for an anchor with href starting with "tel:". The website URL — look for an anchor with a data-item-id containing "authority" or with text content that looks like a domain. The rating as a decimal number. The total review count as an integer. The primary category label.

Store these as the complete lead object and emit a lead-updated event with the enriched data.

---

### Prompt 9.2 — Hours, Category, and Additional Fields

Extend the business detail extraction to collect additional fields from the detail panel.

Extract the opening hours by looking for the hours section on the detail page. Google Maps shows opening hours in a collapsible section. If the section is collapsed, click on it using humanClick to expand it. After expanding, wait humanWait between 300 and 600 milliseconds, then extract each day's hours as a key-value object, for example Monday as "9 AM to 5 PM". If no hours are found, store null for this field.

Extract the "Popular times" data if present. This appears as a chart showing busy hours per day. Extract the day labels and the relative busyness values if they are present in the DOM as text or data attributes. Store this as a popular_times object or null.

Extract any "Attributes" visible in the detail panel. These are small labels such as "Dine-in", "Takeout", "Outdoor seating", "Wi-Fi", "Wheelchair accessible". Collect these as an array of strings.

Extract the list of photos count if visible (a button showing "See all [N] photos"). Store the count as an integer.

Extract the Google Maps Plus Code if visible in the address section. This is a short alphanumeric code like "QCMG+3V Tunis".

All of these fields are optional — if any are not found, store null rather than throwing an error. The scraper must be resilient to variation in what Google Maps shows for different businesses.

---

## 10. Google Maps Scraping — Reviews Extraction

### Prompt 10.1 — Navigating to the Reviews Tab

Build the reviews extraction function. This function is called for each business after the main detail extraction, but only if the user's configuration has scrape_reviews set to true and the business has at least 1 review.

From the business detail page, find and click the "Reviews" tab. Google Maps shows tabs including "Overview", "Reviews", and "About" near the top of the detail panel. Find the tab with text content "Reviews" and click it using humanClick. Wait for the reviews section to appear using waitForSelector with a 8-second timeout.

After the reviews section loads, wait humanWait between 800 and 1500 milliseconds before beginning extraction. Move the mouse to the reviews area using humanMouseMove.

---

### Prompt 10.2 — Sorting Reviews by Most Recent

Before extracting reviews, sort them by most recent. By default Google Maps shows "Most relevant" reviews first. To get the 50 most recent reviews, the sort order must be changed.

Find the sort dropdown or button in the reviews section. Google Maps uses a button or select element to choose between "Most relevant", "Newest", "Highest rating", and "Lowest rating". The button may appear as a dropdown that shows the current sort option.

Click this sort control using humanClick. Wait humanWait between 400 and 800 milliseconds. A dropdown menu should appear. Find the option for "Newest" in the dropdown and click it using humanClick. Wait humanWait between 1000 and 2000 milliseconds for the reviews to reload with the new sort order.

If the sort control cannot be found after trying multiple selectors, proceed with the default sort order and note in the review data that sort order may not be "newest". Do not fail the entire review extraction if the sort control is not found.

---

### Prompt 10.3 — Scrolling and Extracting Reviews

Build the review extraction loop that collects the 50 most recent reviews.

After sorting by newest, the reviews appear as a scrollable list inside the detail panel. Implement the following loop.

Initialize an empty array for collected reviews. Set a target of 50 reviews.

While the collected reviews count is below 50, perform the following steps.

Find all currently visible review elements. Each review element contains the author name, the author's profile image URL, the rating (as a count of filled stars or as an aria-label), the published time as a relative string (such as "2 weeks ago"), and the review text. Some reviews may have no text, only a star rating — include these with an empty text string.

For each review element not already collected, extract all available fields and push to the array.

After processing current reviews, scroll down within the reviews container using humanScroll with a distance between 300 and 500 pixels. Wait humanWait between 600 and 1200 milliseconds for more reviews to load.

If no new reviews appeared after two consecutive scrolls, break the loop — there are no more reviews available.

Stop the loop when 50 reviews are collected or when no more reviews load.

Return the reviews array. If fewer than 50 are available, return whatever was found.

After extraction, emit a status event saying "Reviews collected for [business name] — [count] reviews found".

---

### Prompt 10.4 — Rating Extraction from Star Elements

Build a robust star rating extraction utility for the review elements. Google Maps does not always expose the numerical rating as plain text inside the review. Instead, it often uses a row of star SVG elements where filled stars indicate the rating, or it uses an aria-label on the star container.

Try the following extraction strategies in order and use the first one that succeeds.

First, look for an aria-label on the star rating container element. The aria-label often contains text like "4 stars" or "Rated 4.0 out of 5". Parse the number from this string using a regex that matches one or two digits optionally followed by a decimal point and one digit.

Second, count the number of filled or full star SVG elements inside the rating container. Compare to the total star count to determine the rating. A container with 4 filled stars out of 5 total is a rating of 4.

Third, look for any element with a data attribute like data-rating or data-score near the review author section.

If none of these strategies succeed, store null for the rating of that specific review.

---

## 11. Data Sync — Worker to SaaS Dashboard

### Prompt 11.1 — Batch Upload Strategy

Build the data upload manager in the desktop worker. This manager runs in parallel with the scraping engine and syncs data to the API in batches.

The upload strategy works as follows. The scraping engine pushes leads to an in-memory queue as they are collected. The upload manager watches this queue and uploads in batches of 10 leads at a time. After each batch upload, clear those leads from the queue. If an upload fails due to a network error, retry up to 3 times with exponential backoff (wait 2 seconds, then 4 seconds, then 8 seconds between retries). If all retries fail, keep the leads in the queue and retry the entire queue after 30 seconds.

While offline, continue scraping and accumulating leads in the queue. When the connection is restored, upload all queued leads.

Show the current upload queue size in the worker UI as a small indicator, for example "12 leads pending sync".

For reviews, upload them immediately after each individual business's review extraction completes, using the dedicated reviews endpoint. Do not batch reviews — upload per business.

---

### Prompt 11.2 — Session Lifecycle Management

Build the scraping session management in both the worker and the API.

When the user clicks "Start Scraping" in the worker, the worker calls POST /api/worker/session/start with a body containing the job configuration (city, business_type, max_results, scrape_reviews). The API creates a scraping_sessions record and returns a session_id. The worker stores this session_id and includes it with every lead upload.

When the session ends (either the user clicks Stop, the max_results is reached, or an unrecoverable error occurs), the worker calls POST /api/worker/session/end with the session_id, the total leads collected, the total reviews collected, the end reason (completed, stopped, error), and the duration in seconds. The API updates the session record with these final stats.

Create a scraping_sessions table with columns: id, user_id, session_id as a unique string, city, business_type, max_results, leads_collected defaulting to 0, reviews_collected defaulting to 0, status as text, started_at, ended_at, end_reason, and worker_version.

On the dashboard, show the session history on the Reports page with all these fields.

---

### Prompt 11.3 — Real-Time Dashboard Updates

Implement real-time updates in the Next.js dashboard so that as the worker uploads leads, the dashboard updates without requiring a page refresh.

Use Supabase Realtime. Set up a subscription in the dashboard's overview page that listens for INSERT events on the businesses table filtered by the current user's user_id. When a new lead is inserted, increment the total leads counter displayed on the page and append the new lead to the top of the "Recent Leads" table.

Also subscribe to UPDATE events on the scraping_sessions table filtered by user_id. When a session's leads_collected field updates, show the new count in the "Worker Status" panel under "Leads collected this session".

Show a small pulsing green dot next to "Live" text when an active Supabase Realtime subscription is connected. Show a gray dot when the subscription is disconnected.

When a new lead arrives via realtime, briefly highlight the new row in the table with a subtle background color animation that fades out over 2 seconds, drawing the user's attention to the newly arrived data.

---

## 12. Real-Time Scraping Visibility (Live Browser Window)

### Prompt 12.1 — Designing the Live Browser Feature

Design and document the "live browser" feature which is the most visible and differentiating product feature of AutoReach V2. The live browser feature means that when the desktop worker runs, the user sees a real Chromium browser window open on their screen and can watch every action the scraper takes — navigation, typing, scrolling, clicking — in real time.

This feature requires no additional implementation work beyond what is already specified. It is a direct result of using Playwright in non-headless mode (headless: false). The browser window is the Playwright-controlled Chromium instance.

Document the following product decisions about this feature.

The browser window should open behind the worker's main Electron window by default, not in front of it. The user should see the worker UI first. The browser is visible in the taskbar and the user can click to bring it forward at any time.

The worker UI should show a button labeled "Watch browser" that brings the Chromium window to the foreground using Playwright's page.bringToFront method exposed via an IPC handler.

Do not add any custom overlays, annotations, or highlights to the browser window. The user sees the real Google Maps interface exactly as it appears to a normal user. This is intentional — adding overlays would require injecting scripts that change the page's appearance, which could increase detection risk and also confuses some users.

Include a disclaimer in the worker UI that says "The browser window is being controlled automatically. Do not click, type, or scroll inside it while scraping is running."

---

### Prompt 12.2 — Live Feed in the Worker UI

Alongside the live browser window, the worker UI must show a text-based live feed of scraping activity. This gives the user something to read in the worker window while watching the browser.

The live feed is a vertically scrolling list inside the worker UI window. New events appear at the top. Older events scroll down. Keep the last 200 events in memory. Do not persist the live feed to disk.

Each feed entry has a timestamp (just hours and minutes, not seconds), a colored dot indicating the event type, and a short description. Use the following color coding. A blue dot for navigation events such as "Navigated to Google Maps". A green dot for successful data events such as "Found: Café Central — 4.5 stars — Tunis". A yellow dot for warning events such as "No phone number found for this business". A red dot for error events such as "Page load timeout — retrying". A gray dot for system events such as "Pausing 2.3s before next business".

Make the live feed auto-scroll to the top as new events arrive, but stop auto-scrolling if the user has manually scrolled down in the feed (indicating they are reading older events). Resume auto-scrolling when the user scrolls back to the top.

---

## 13. Dashboard — Leads & Results View

### Prompt 13.1 — Leads Table

Build the /dashboard/leads page. This page shows all leads collected by the user's worker, with filtering and sorting.

The main content is a data table with the following columns: a checkbox for bulk selection, Business Name (sortable), Category, City, Rating (sortable, shown as stars and a number), Reviews Count (sortable), Phone, Email (show as green check icon if found, red x if not), Website (show as external link icon if found), Stage (shown as a colored badge), and a row of action buttons (View Details, Send Email, Delete).

Above the table show a filter bar with the following controls. A search input that filters by business name. A city filter dropdown populated with the unique cities from the user's leads. A category filter dropdown. A stage filter dropdown with options New, Contacted, Replied, Closed. A "Has Email" toggle. A date range picker for when the lead was collected.

Show a count above the table indicating how many leads match the current filters out of the total.

Support bulk actions. When one or more rows are checked, show a bulk action bar above the table with options: Move to Stage, Export Selected as CSV, Delete Selected.

Implement pagination showing 50 rows per page with page navigation controls.

---

### Prompt 13.2 — Lead Detail Drawer

Build a slide-in drawer that opens from the right side of the screen when the user clicks "View Details" on any lead row.

The drawer shows all available information for the selected lead in organized sections.

The first section is the business header showing the name, category, rating as stars, and total review count. Below the rating show the Google Maps URL as a clickable link.

The second section is contact information showing address, phone (as a clickable tel link), website (as a clickable external link), and email with a "Send Email" button next to it.

The third section is metadata showing the date the lead was collected, which scraping session found it, the city and business type query used, and the GPS coordinates if available.

The fourth section is pipeline stage, showing the current stage as a badge and a dropdown to change the stage. When the stage changes, call the API immediately and show a subtle success toast.

The fifth section is notes, showing a free-text textarea that auto-saves on blur. Show "Saved" in small text when the save completes.

The sixth section is opening hours, shown as a small table with days and hours if available, or "Hours not available" if not.

The seventh section is the attributes list, shown as small tag chips if available.

The eighth section is reviews. Show a count of available reviews and a "Load Reviews" button. When clicked, fetch the reviews for this lead from the API and display them as a list. Each review shows the author name, star rating, relative date, and review text truncated to 3 lines with a "Show more" toggle.

---

## 14. Dashboard — Pipeline & CRM

### Prompt 14.1 — Kanban Pipeline View

Build the /dashboard/pipeline page. This page shows all leads organized in a kanban-style board with four columns: New, Contacted, Replied, and Closed.

Each column shows a count of leads in that stage and a scrollable list of lead cards. Each card shows the business name, city, email (with a color indicator), rating, and two quick action buttons: "Send Email" and "Move Stage".

Allow drag-and-drop between columns. When a card is dropped into a new column, immediately call the API to update the stage and show a brief animation on the card confirming the move. If the API call fails, revert the card to its original column and show an error toast.

At the top of the page show summary statistics: conversion rates between each stage shown as percentages (what percentage of New leads become Contacted, what percentage of Contacted leads become Replied, and so on).

Add a "Bulk move" feature on each column header: a button that opens a dialog asking "Move all [N] leads in [stage] to which stage?" with a dropdown. This is useful for bulk pipeline operations.

---

## 15. Email Outreach Module (Existing AutoReach Logic)

### Prompt 15.1 — Port Email Outreach to the SaaS Dashboard

Port the existing AutoReach V1 email outreach logic into the new SaaS dashboard. The following components from V1 must be preserved and integrated.

The Groq API integration for generating personalised email bodies must be moved to the API server and exposed as a POST /api/dashboard/outreach/generate endpoint. The frontend calls this endpoint with a lead object and receives back a generated subject and body.

The Resend API integration for sending emails must remain server-side and be exposed as POST /api/dashboard/outreach/send. The server never exposes the Resend API key to the frontend.

The email template system (the ability to save a custom template that gets lightly personalised by Groq) must be moved to the settings page. The template is stored in the database settings table per user, not in a file.

The sent_log table from V1 maps directly to a sent_emails table in the new schema. All previous V1 log fields are preserved.

The unsubscribe system must be preserved. Each outgoing email includes an unsubscribe link pointing to the SaaS app's /unsubscribe route, not a local route. The route updates the lead's unsubscribed field in the database.

---

### Prompt 15.2 — Outreach Campaign Builder

Build the /dashboard/outreach page. This is where users set up and run email outreach campaigns.

The page has two sections. The left section is the campaign builder. The right section is a preview of the generated email.

In the campaign builder, the user selects a set of leads to contact using a multi-select interface that shows their filtered leads. The user can filter by city, category, stage (typically they want to contact "New" leads), and "Has Email" set to true.

Below the lead selection, the user chooses or edits the email template. Show the template editor as a textarea with a character count. Show a button "Generate Preview" which picks a random lead from the selection and calls the Groq API to generate a personalised email, displaying it in the right preview section.

Below the template, show a "Send Settings" section with a toggle for "Enable AI personalisation" (uses Groq to lightly personalise each email), a language selector (English or Arabic — add Arabic as a new supported language in V2 alongside the existing English and Greek from V1), and a sending speed control (Normal = 1 email every 3 to 6 minutes, Slow = 1 email every 8 to 15 minutes) to avoid sending too many emails in quick succession.

Show a "Launch Campaign" button. When clicked, show a confirmation dialog listing how many leads will be contacted, the estimated time to complete, and the email template preview. After confirmation, the campaign is queued on the server and processed in the background.

Show a "Running Campaigns" section at the bottom of the page listing any active campaigns with their progress (emails sent out of total), start time, and a Pause button.

---

## 16. Follow-Up Automation

### Prompt 16.1 — Follow-Up System (Port from V1 with Enhancements)

Port the follow-up system from AutoReach V1 with the following enhancements.

The follow-up schedule remains day 3, day 7, and day 14 after the initial email. The Groq-generated copy for each step is preserved as described in V1.

Add the following new capabilities.

Allow the user to customise the follow-up schedule from the dashboard settings. They can change the day intervals, enable or disable specific steps, and set a custom template for each step independently.

Add Arabic language support for all three follow-up steps in addition to the existing English and Greek.

Move the follow-up execution from a manual trigger to a scheduled background job. Use a node-cron job on the API server that runs every hour, checks the sent_emails table for any emails that have a follow-up due, and sends them automatically without any manual action from the user.

Add a "Follow-Up Log" section on the Reports page that shows all follow-up emails sent, which step they were, and which business received them.

Add a clear "Unsubscribe stops all follow-ups immediately" note in the settings page and ensure the follow-up background job always checks the unsubscribed flag before sending.

---

## 17. Worker Auto-Update System

### Prompt 17.1 — Electron Auto-Update

Implement automatic updates for the Electron desktop worker using the electron-updater package from electron-builder.

Store releases on GitHub Releases. Configure electron-builder to publish builds to a GitHub repository with a personal access token stored as an environment variable in the CI pipeline.

On worker startup, after the connection check, call autoUpdater.checkForUpdatesAndNotify(). If an update is available, show a non-blocking banner in the worker UI saying "A new version is available. Downloading in background." Show a progress bar in the banner as the download progresses. After the download is complete, change the banner to say "Update ready — restart to apply" with a "Restart Now" button. Do not force the user to restart immediately.

If the update check fails (network error or no update server available), fail silently and log the error to a local log file without showing any error to the user.

Store the current version string in the worker's electron-store and include it in every API request header as X-Worker-Version. The API logs this in the worker_sessions table. The dashboard settings page shows the user their current worker version and whether it is up to date.

---

## 18. Security & API Key Management

### Prompt 18.1 — Environment Variable Structure

Define the complete set of environment variables for each component of the system.

For the Next.js SaaS frontend, define the following variables. NEXTAUTH_URL as the full public URL of the SaaS app. NEXTAUTH_SECRET as a random 32-character string for JWT signing. NEXT_PUBLIC_SUPABASE_URL as the Supabase project URL. NEXT_PUBLIC_SUPABASE_ANON_KEY as the Supabase anonymous key. SUPABASE_SERVICE_ROLE_KEY as the Supabase service role key (server-side only, never exposed to browser). NEXT_PUBLIC_API_URL as the public URL of the Express API server. GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for Google OAuth. GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET for GitHub OAuth.

For the Express API server, define the following variables. DATABASE_URL as the PostgreSQL connection string. JWT_SECRET as the shared secret for signing worker JWTs (must match the value known to the worker build). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for direct Supabase access. RESEND_API_KEY for email sending. GROQ_API_KEY for AI copy generation. RESEND_FROM_EMAIL as the sender address. APP_BASE_URL as the public URL of the SaaS app (used for building unsubscribe links). NODE_ENV as production or development.

For the Electron desktop worker, store all configuration in electron-store, not in environment variables, because the worker runs on the end user's machine and environment variables are not appropriate for end-user applications. The only value that needs to be baked into the worker build at compile time is the API_BASE_URL pointing to the production API server.

---

### Prompt 18.2 — Worker Token Security

Document the security model for worker tokens and implement it.

A worker token is a 32-byte cryptographically random hex string generated once at user account creation. It is equivalent to an API key. It grants full access to all API endpoints for that user's account.

The token is shown to the user only on the dashboard download page. It is never sent in email. It is never logged server-side in any log file. It is never included in any analytics or error reporting payload.

On the client side, the token is stored in electron-store with the encryption option enabled using the machine's hardware identifier as the encryption key. The token is never stored in localStorage, sessionStorage, or any browser storage.

Allow the user to regenerate their token from the dashboard settings page. When regenerated, the old token immediately becomes invalid. Any connected worker sessions using the old token will receive 401 responses on their next API call and must prompt the user to enter the new token.

Implement token regeneration as a POST /api/dashboard/settings/regenerate-token endpoint that creates a new token, saves it to the user record, and returns it once in the response. The new token is displayed in a modal that the user must explicitly dismiss, with a note that this is the only time it will be shown in full.

---

## 19. Database Schema (Full)

### Prompt 19.1 — Prisma Schema Definition

Write the complete Prisma schema for AutoReach V2. Include all models with all fields, relations, indexes, and constraints.

The schema must include the following models.

A User model with id as a UUID string primary key, email as a unique string, passwordHash as an optional string, name as an optional string, avatarUrl as an optional string, workerToken as a unique string, plan as a string defaulting to "free", createdAt as a DateTime defaulting to now, and updatedAt as a DateTime updated on every write. The User has many Businesses, many SentEmails, many FollowupLogs, many ScrapingSessions, many WorkerSessions, and one UserSettings.

A UserSettings model with id, userId as a unique foreign key, emailTemplate as an optional string, followupStep3Enabled as boolean defaulting to true, followupStep7Enabled as boolean defaulting to true, followupStep14Enabled as boolean defaulting to true, followupStep3Days as integer defaulting to 3, followupStep7Days as integer defaulting to 7, followupStep14Days as integer defaulting to 14, scrollDelayMin as integer defaulting to 800, scrollDelayMax as integer defaulting to 1800, and defaultLanguage as string defaulting to "english".

A Business model with id, userId, name, address, phone, website, email, googleMapsUrl as an optional unique string (unique per user — add a compound unique constraint on userId and googleMapsUrl), rating as optional Decimal, reviewCount as optional integer, category, city, businessType, latitude as optional Decimal, longitude as optional Decimal, plusCode as optional string, photoCount as optional integer, openingHours as optional JSON, attributes as optional JSON, popularTimes as optional JSON, stage as string defaulting to "New", notes as optional string, unsubscribed as boolean defaulting to false, sessionId as an optional foreign key, createdAt, updatedAt.

A Review model with id, businessId as a foreign key, authorName, authorImageUrl as optional string, rating as optional integer, text as optional string, publishedAt as optional string, createdAt.

A ScrapingSession model with id, userId, city, businessType, maxResults, scrapeReviews as boolean, leadsCollected defaulting to 0, reviewsCollected defaulting to 0, status, startedAt, endedAt as optional DateTime, endReason as optional string, workerVersion as optional string.

A WorkerSession model with id, userId, machineName, platform, workerVersion, connectedAt, lastPing, status.

A SentEmail model with id, userId, businessId as optional foreign key, businessName, email, subject, body, dateSent, language defaulting to "english".

A FollowupLog model with id, userId, businessId as optional foreign key, businessName, email, originalDateSent, followupStep as integer, dateSent, subject, body.

A ScrapingJob model with id, userId, city, businessType, maxResults defaulting to 200, scrapeReviews as boolean defaulting to true, status defaulting to "pending", createdAt, startedAt as optional DateTime, completedAt as optional DateTime.

---

## 20. Deployment Prompts

### Prompt 20.1 — API Server Deployment on Railway

Write a complete Railway deployment configuration for the Express API server.

Create a railway.toml file that specifies a Node.js service. Set the build command to npm run build which compiles TypeScript to JavaScript. Set the start command to node dist/index.js. Set the health check path to GET /health which returns 200 JSON with status ok and the current timestamp.

Create a Dockerfile alternative if Railway's auto-detection does not work correctly. The Dockerfile uses a Node.js 20 Alpine base image, copies package.json and package-lock.json, runs npm ci with production flag, copies the compiled JavaScript, runs prisma generate, exposes port 3001, and starts the server.

Create a GitHub Actions workflow file that builds the project, runs the TypeScript type checker and any unit tests, and if all checks pass, triggers a Railway deployment by calling the Railway deploy webhook URL stored as a GitHub secret.

Set up the following environment variables in the Railway project dashboard: all variables listed in Prompt 18.1 for the API server. Set NODE_ENV to production.

---

### Prompt 20.2 — SaaS Frontend Deployment on Vercel

Write the Vercel deployment configuration for the Next.js SaaS frontend.

Create a vercel.json file at the project root. Configure the build command as npm run build. Configure the output directory as .next. Configure all environment variables listed in Prompt 18.1 for the Next.js frontend to be set in the Vercel project settings, not in the vercel.json file (because vercel.json is public in the repository).

Create a GitHub Actions workflow that runs on push to the main branch: installs dependencies, runs TypeScript type checking, runs the build to verify it succeeds, then triggers a Vercel deployment via the Vercel CLI using a deploy token stored as a GitHub secret.

Set up Vercel's preview deployment feature for pull requests. Each pull request should get its own preview URL so that changes can be tested before merging to main. Configure the preview deployments to use a separate set of environment variables pointing to a staging database and staging API server.

---

### Prompt 20.3 — Electron Build & Release Pipeline

Write the GitHub Actions workflow for building and releasing the Electron desktop worker.

The workflow is triggered on push to any tag matching the pattern v*.*.* (semantic version tags). It runs three parallel jobs: one for Windows, one for macOS, and one for Linux.

The Windows job runs on a windows-latest runner. It installs dependencies, runs electron-builder with the --win target, and uploads the resulting NSIS installer file as a workflow artifact.

The macOS job runs on a macos-latest runner. It installs dependencies, runs electron-builder with the --mac target, and uploads the resulting DMG file as a workflow artifact. Note that macOS builds require code signing. If code signing certificates are not yet set up, configure electron-builder to skip signing in CI by setting the CSC_IDENTITY_AUTO_DISCOVERY environment variable to false and document that the resulting build will show a warning to macOS users which they must bypass.

The Linux job runs on an ubuntu-latest runner. It installs dependencies, installs the required system libraries for Electron on Linux, runs electron-builder with the --linux target, and uploads the resulting AppImage as a workflow artifact.

After all three build jobs succeed, a final release job downloads all three artifacts and creates a GitHub Release using the tag name. It uploads all three installer files to the release. It also updates a latest.yml file in the repository that electron-updater uses to check for new versions. The API_BASE_URL value is baked into the build using electron-builder's extraMetadata configuration, pulling the value from a repository secret.

---

*End of AutoReach V2 Prompt Pack — 20 sections, 47 prompts total.*

*Use these prompts sequentially with an AI coding assistant. Each prompt builds on the previous ones. Do not skip sections. When a prompt references a concept from an earlier prompt (such as "the worker authentication middleware from Prompt 3.2"), ensure that earlier work is complete before proceeding.*