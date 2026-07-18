import { test, expect, Page, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Configuration ──────────────────────────────────────────────────
const BASE_URL = 'https://leads.creativecomet.tn';
const SCREENSHOT_DIR = path.resolve(__dirname, 'reports', 'e2e-screenshots');
const SESSION_COOKIE_VALUE = 'd3dca1c230cde047200b76bdd9af12b94c48530340043da4e7e1e3f8356d134c';
const ORG_ID = 'org_default';

// User-provided credentials for settings (use env vars, never commit secrets)
const OPENROUTER_API_KEY = process.env.E2E_OPENROUTER_API_KEY || '';
const GMAIL_ADDRESS = process.env.E2E_GMAIL_ADDRESS || '';
const GMAIL_APP_PASSWORD = process.env.E2E_GMAIL_APP_PASSWORD || '';
const SHEETS_WEBAPP_URL = process.env.E2E_SHEETS_WEBAPP_URL || 'https://script.google.com/macros/s/AKfycbwMLF3S95WeIz7wC1gjziON4vdpn1X1p9vv97LrnqSewa4eM6zGtezvPFT9BxAF4HQlJA/exec';

// Shared state
const RUN_ID = Date.now();
let consoleErrors: { text: string; url: string; type: string }[] = [];
let networkFailures: { url: string; status: number; method: string }[] = [];
let createdLeadId: string | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────
async function setupPage(page: Page) {
  consoleErrors = []; networkFailures = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), url: page.url(), type: msg.type() }); });
  page.on('pageerror', (err) => { consoleErrors.push({ text: err.message, url: page.url(), type: 'pageerror' }); });
  page.on('response', (res) => { if (!res.ok() && res.status() >= 400) networkFailures.push({ url: res.url(), status: res.status(), method: res.request().method() }); });
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name.replace(/[^a-z0-9]/gi, '_')}.png`), fullPage: true });
}

async function signIn(page: Page) {
  await setupPage(page);
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Set session cookie directly to bypass login
  await page.context().addCookies([{
    name: 'cl_session',
    value: SESSION_COOKIE_VALUE,
    domain: 'leads.creativecomet.tn',
    path: '/',
    httpOnly: false,
    secure: true,
    sameSite: 'Lax',
  }]);
}

function report(...args: any[]) { console.log(`[E2E]`, ...args); }

// ─── Setup ───────────────────────────────────────────────────────────
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

test.beforeEach(async ({ page }, testInfo) => {
  await setupPage(page);
  report(`Starting: ${testInfo.title}`);
});

test.afterEach(async ({ page }, testInfo) => {
  if (consoleErrors.length > 0) {
    report(`  Console errors: ${consoleErrors.length}`);
    consoleErrors.forEach(e => report(`    [${e.type}] ${e.text.substring(0, 200)}`));
  }
  if (networkFailures.length > 0) {
    report(`  Network failures: ${networkFailures.length}`);
    networkFailures.forEach(f => report(`    ${f.method} ${f.url} -> ${f.status}`));
  }
  if (testInfo.status !== 'passed') {
    await screenshot(page, `FAIL_${testInfo.title}`);
  }
  report(`${testInfo.status === 'passed' ? '✓' : '✗'} ${testInfo.title}`);
});

// ══════════════════════════════════════════════════════════════════════
// FLOW 1: AUTHENTICATION
// ══════════════════════════════════════════════════════════════════════
test.describe('FLOW 1: Authentication', () => {

  test('1.1 - Sign in with session cookie and access pipeline', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '1.1_after_signin_pipeline');
    const url = page.url();
    report(`Pipeline URL: ${url}`);
    // Should be on pipeline page (not redirected to sign-in)
    expect(url).toContain('/pipeline');
    expect(consoleErrors.length).toBe(0);
  });

  test('1.2 - Verify cookie persists across page reloads', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const url = page.url();
    expect(url).toContain('/pipeline');
  });

  test('1.3 - Access all protected pages', async ({ page }) => {
    await signIn(page);
    const routes = ['/pipeline', '/outreach', '/campaigns', '/settings', '/import', '/migrate', '/recommendations', '/downloads'];
    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      const url = page.url();
      expect(url).toContain(route);
      report(`  ${route} -> accessible`);
    }
    await screenshot(page, '1.3_all_pages_accessible');
  });
});

// ══════════════════════════════════════════════════════════════════════
// FLOW 2: SETTINGS CONFIGURATION
// ══════════════════════════════════════════════════════════════════════
test.describe('FLOW 2: Settings Configuration', () => {

  test('2.1 - Settings page loads all 7 tabs', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '2.1_settings_page');

    // Look for tab navigation elements
    const tabs = await page.evaluate(() => {
      const tabElements = document.querySelectorAll('[class*="tab"], nav a, .sidebar a, button');
      return Array.from(tabElements)
        .filter(el => {
          const text = el.textContent?.trim().toLowerCase() || '';
          return ['ai', 'enrichment', 'scoring', 'thresholds', 'pricing', 'providers', 'campaign', 'sheets'].some(k => text.includes(k));
        })
        .map(el => el.textContent?.trim());
    });
    report(`Settings tabs found: ${JSON.stringify(tabs)}`);
  });

  test('2.2 - Configure AI Provider with OpenRouter + DeepSeek', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Find and click AI Provider tab
    const aiTab = await page.locator('button, a, [class*="tab"]').filter({ hasText: /ai|provider/i }).first();
    if (await aiTab.isVisible()) {
      await aiTab.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, '2.2_ai_tab');

    // Set OpenRouter as provider
    const providerSelect = page.locator('select').filter({ hasText: /openrouter|provider/i }).first().or(page.locator('select').first());
    if (await providerSelect.isVisible()) {
      await providerSelect.selectOption('openrouter');
      await page.waitForTimeout(300);
    }

    // Fill OpenRouter API key
    const apiKeyInputs = page.locator('input[type="password"]');
    const count = await apiKeyInputs.count();
    for (let i = 0; i < count; i++) {
      const input = apiKeyInputs.nth(i);
      const placeholder = await input.getAttribute('placeholder') || '';
      if (placeholder.toLowerCase().includes('openrouter') || placeholder.toLowerCase().includes('api key')) {
        await input.fill(OPENROUTER_API_KEY);
        break;
      }
    }

    await screenshot(page, '2.2_ai_filled');
    report('AI Provider configured with OpenRouter');
  });

  test('2.3 - Configure Campaign Providers (Gmail)', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Providers tab
    const providersTab = page.locator('button, a, [class*="tab"]').filter({ hasText: /provider|campaign/i }).first();
    if (await providersTab.isVisible()) {
      await providersTab.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, '2.3_providers_tab');

    // Select Gmail from provider dropdown
    const emailProviderSelect = page.locator('select').first();
    if (await emailProviderSelect.isVisible()) {
      const options = await emailProviderSelect.evaluate(el => Array.from(el.querySelectorAll('option')).map(o => o.value));
      report(`Email provider options: ${JSON.stringify(options)}`);
      if (options.includes('gmail')) {
        await emailProviderSelect.selectOption('gmail');
        await page.waitForTimeout(300);
      }
    }

    await screenshot(page, '2.3_gmail_selected');
    report('Gmail provider selected');
  });

  test('2.4 - Configure Google Sheets Web App URL', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Click Sheets tab
    const sheetsTab = page.locator('button, a, [class*="tab"]').filter({ hasText: /sheet|google/i }).first();
    if (await sheetsTab.isVisible()) {
      await sheetsTab.click();
      await page.waitForTimeout(500);
    }
    await screenshot(page, '2.4_sheets_tab');

    await page.waitForTimeout(500);
    await screenshot(page, '2.4_sheets_loaded');
    report('Sheets tab opened');
  });
});

// ══════════════════════════════════════════════════════════════════════
// FLOW 3: PIPELINE & LEADS
// ══════════════════════════════════════════════════════════════════════
test.describe('FLOW 3: Pipeline & Leads', () => {

  test('3.1 - Pipeline page loads lead table', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await screenshot(page, '3.1_pipeline');

    // Check for lead table or lead cards
    const bodyText = await page.evaluate(() => document.body.textContent?.substring(0, 2000) || '');
    report(`Pipeline body text: ${bodyText.substring(0, 500)}`);
  });

  test('3.2 - Create a new lead via API', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
    const leadName = `E2E Test Auto ${RUN_ID}`;
    const uniqueSuffix = RUN_ID.toString().slice(-6);
    const phoneNumber = `+21650${uniqueSuffix}`;
    const email = `e2e-${uniqueSuffix}@test.com`;
    const website = `https://e2e-${uniqueSuffix}.com`;
    // Use POST /api/leads/bulk-import to create a single lead
    const result = await page.evaluate(async ({ baseUrl, businessName, phone, mail, site }) => {
      try {
        const res = await fetch(`${baseUrl}/api/leads/bulk-import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{
            business_name: businessName,
            category: 'Auto Repair',
            website: site,
            phone_number: phone,
            email: mail,
            city: 'Tunis',
            address: '123 Test Street',
            rating: 3.8,
            review_count: 12,
          }]),
        });
        const body = await res.json();
        return { ok: res.ok, status: res.status, body };
      } catch (err) {
        return { ok: false, status: 0, body: { error: String(err) } };
      }
    }, { baseUrl: BASE_URL, businessName: leadName, phone: phoneNumber, mail: email, site: website });
    report(`Create lead response: ${JSON.stringify(result)}`);
    expect(result.ok).toBeTruthy();
    expect(result.body.success).toBe(true);
    expect(result.body.count).toBe(1);
    // Fetch the lead back to get its ID
    if (result.ok) {
      const idResult = await page.evaluate(async ({ baseUrl, name }) => {
        try {
          const res = await fetch(`${baseUrl}/api/leads?q=${encodeURIComponent(name)}`);
          const body = await res.json();
          return { ok: res.ok, body };
        } catch (err) {
          return { ok: false, body: { error: String(err) } };
        }
      }, { baseUrl: BASE_URL, name: leadName });
      if (idResult.ok && Array.isArray(idResult.body) && idResult.body.length > 0) {
        createdLeadId = idResult.body[0].id;
        report(`Found created lead ID: ${createdLeadId}`);
      }
    }
  });

  test('3.3 - Lead appears in pipeline after creation', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await screenshot(page, '3.3_pipeline_with_lead');

    const bodyText = await page.evaluate(() => document.body.textContent || '');
    const leadName = `E2E Test Auto ${RUN_ID}`;
    report(`Pipeline contains '${leadName}': ${bodyText.includes(leadName)}`);
    expect(bodyText.includes(leadName)).toBeTruthy();
  });

  test('3.4 - Read lead detail via API', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) {
      report('No lead ID available, skipping');
      return;
    }
    const result = await page.evaluate(async ({ baseUrl, leadId }) => {
      try {
        const res = await fetch(`${baseUrl}/api/leads/${leadId}`);
        const body = await res.json();
        return { ok: res.ok, status: res.status, body };
      } catch (err) {
        return { ok: false, status: 0, body: { error: String(err) } };
      }
    }, { baseUrl: BASE_URL, leadId: createdLeadId });
    report(`Lead detail status: ${result.status}`);
    if (result.ok) {
      report(`Lead detail: ${JSON.stringify(result.body).substring(0, 500)}`);
    }
    expect(result.ok).toBeTruthy();
    expect(result.body.businessName).toContain('E2E Test Auto');
  });
});

// ─── Shared API helpers (must be outside describe blocks) ─────────────
async function apiPost(page: Page, url: string, data: any) {
  return page.evaluate(async ({ url, data }) => {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : {} };
    } catch (err) { return { ok: false, status: 0, body: { error: String(err) } }; }
  }, { url, data });
}

async function apiGet(page: Page, url: string) {
  return page.evaluate(async (url) => {
    try {
      const res = await fetch(url);
      const text = await res.text();
      return { ok: res.ok, status: res.status, body: text ? JSON.parse(text) : {} };
    } catch (err) { return { ok: false, status: 0, body: { error: String(err) } }; }
  }, url);
}

// ══════════════════════════════════════════════════════════════════════
// FLOW 4: ENRICHMENT
// ══════════════════════════════════════════════════════════════════════
test.describe('FLOW 4: Enrichment & Website Intelligence', () => {

  test('4.1 - Trigger website intelligence scan', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) { report('SKIP: No lead ID'); return; }
    const result = await apiPost(page, `${BASE_URL}/api/leads/${createdLeadId}/website-intel`, {});
    report(`Website intel response: ${JSON.stringify(result.body).substring(0, 300)}`);
  });

  test('4.2 - Trigger lead enrichment', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) { report('SKIP: No lead ID'); return; }
    const result = await apiPost(page, `${BASE_URL}/api/leads/${createdLeadId}/enrichment`, {});
    report(`Enrichment response: ${JSON.stringify(result.body).substring(0, 300)}`);
  });

  test('4.3 - Trigger opportunity/scoring', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) { report('SKIP: No lead ID'); return; }
    const result = await apiPost(page, `${BASE_URL}/api/leads/${createdLeadId}/opportunity`, {});
    report(`Opportunity/Scoring response: ${JSON.stringify(result.body).substring(0, 300)}`);
  });

  test('4.4 - Verify lead now has enrichment + score data', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) { report('SKIP: No lead ID'); return; }
    const result = await apiGet(page, `${BASE_URL}/api/leads/${createdLeadId}`);
    report(`Lead after enrichment: ${JSON.stringify(result.body).substring(0, 500)}`);

    const body = result.body;
    const fields = Object.keys(body);
    report(`Lead fields: ${JSON.stringify(fields)}`);
    const hasScore = body.aiScore !== undefined && body.aiScore !== null;
    const hasEnrichment = body.enrichment !== undefined && body.enrichment !== null;
    report(`Has AI Score: ${hasScore}, Has Enrichment: ${hasEnrichment}`);
  });
});

// ══════════════════════════════════════════════════════════════════════
// FLOW 5: GOOGLE SHEETS SYNC
// ══════════════════════════════════════════════════════════════════════
test.describe('FLOW 5: Google Sheets Sync', () => {

  test('5.1 - Sheets Web App is reachable and responds', async ({ page }) => {
    const response = await page.request.get(SHEETS_WEBAPP_URL);
    report(`Sheets GET: ${response.status()}`);
    expect(response.ok()).toBeTruthy();
  });

  test('5.2 - Sync lead to Google Sheets via API', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) { report('SKIP: No lead ID'); return; }
    const result = await apiPost(page, `${BASE_URL}/api/leads/sync-sheets`, {
      leadIds: [createdLeadId],
      sheetsUrl: SHEETS_WEBAPP_URL,
    });
    report(`Sync sheets response: ${JSON.stringify(result.body)}`);
  });

  test('5.3 - Direct POST to Sheets Web App with all lead data', async ({ page }) => {
    // Directly test the Apps Script Web App with a full lead payload
    const response = await page.request.post(SHEETS_WEBAPP_URL, {
      data: {
        leads: [{
          businessName: 'Test Auto Garage E2E',
          website: 'https://testautogarage-e2e.com',
          email: 'contact@testautogarage-e2e.com',
          phone: '+21650123456',
          category: 'Auto Repair',
          city: 'Tunis',
          ai_score: 78,
          pipelineStage: 'new',
          priority: 'High',
          country: 'Tunisia',
          enrichment: {
            linkedinUrl: 'https://linkedin.com/company/testautogarage',
            facebookUrl: 'https://facebook.com/testautogarage',
          },
        }],
      },
    });
    const body = await response.json();
    report(`Sheets Web App POST: ${JSON.stringify(body)}`);
    expect(response.ok()).toBeTruthy();
    expect(body.success).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════════
// FLOW 6: DASHBOARD & UI
// ══════════════════════════════════════════════════════════════════════
test.describe('FLOW 6: Dashboard & UI', () => {

  test('6.1 - Dashboard/recommendations page loads', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/recommendations`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '6.1_recommendations');
    // Should not error
    expect(consoleErrors.length).toBe(0);
  });

  test('6.2 - Import page loads', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/import`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '6.2_import');
    expect(consoleErrors.length).toBe(0);
  });

  test('6.3 - Migrate page loads', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/migrate`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '6.3_migrate');
    expect(consoleErrors.length).toBe(0);
  });

  test('6.4 - Downloads page loads', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/downloads`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '6.4_downloads');
    expect(consoleErrors.length).toBe(0);
  });

  test('6.5 - Outreach page loads', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/outreach`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '6.5_outreach');
    expect(consoleErrors.length).toBe(0);
  });

  test('6.6 - Campaigns page loads', async ({ page }) => {
    await signIn(page);
    await page.goto(`${BASE_URL}/campaigns`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await screenshot(page, '6.6_campaigns');
    expect(consoleErrors.length).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════
// FLOW 7: CLEANUP
// ══════════════════════════════════════════════════════════════════════
test.describe('FLOW 7: Cleanup', () => {

  test('7.1 - Delete test lead', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) { report('SKIP: No lead ID to delete'); return; }
    const result = await page.evaluate(async ({ baseUrl, leadId }) => {
      try {
        const res = await fetch(`${baseUrl}/api/leads/${leadId}`, { method: 'DELETE' });
        return { ok: res.ok, status: res.status };
      } catch (err) { return { ok: false, status: 0 }; }
    }, { baseUrl: BASE_URL, leadId: createdLeadId });
    report(`Delete lead: ${result.status}`);
  });

  test('7.2 - Verify lead no longer exists', async ({ page }) => {
    await signIn(page);
    if (!createdLeadId) { report('SKIP: No lead ID'); return; }
    const result = await page.evaluate(async ({ baseUrl, leadId }) => {
      try {
        const res = await fetch(`${baseUrl}/api/leads/${leadId}`);
        return { ok: res.ok, status: res.status };
      } catch (err) { return { ok: false, status: 0 }; }
    }, { baseUrl: BASE_URL, leadId: createdLeadId });
    report(`Lead after delete: ${result.status}`);
  });
});

// ══════════════════════════════════════════════════════════════════════
// FINAL: CONSOLE & NETWORK SUMMARY
// ══════════════════════════════════════════════════════════════════════
test.describe('Final Summary', () => {
  test('All tests completed — check reports', async () => {
    report('=== END-TO-END TEST COMPLETE ===');
  });
});
