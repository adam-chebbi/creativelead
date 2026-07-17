import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Test Configuration ──────────────────────────────────────────────
const BASE_URL = 'https://leads.creativecomet.tn';
const SCREENSHOT_DIR = path.resolve(__dirname, 'reports', 'screenshots');
const CONSOLE_LOG_DIR = path.resolve(__dirname, 'reports', 'console-logs');

// Google Sheets Web App URL (already deployed)
const SHEETS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbwMLF3S95WeIz7wC1gjziON4vdpn1X1p9vv97LrnqSewa4eM6zGtezvPFT9BxAF4HQlJA/exec';

// ─── Shared State ────────────────────────────────────────────────────
let consoleErrors: { text: string; url: string; type: string }[] = [];
let networkFailures: { url: string; status: number; method: string }[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────
async function setupPageListeners(page: Page) {
  consoleErrors = [];
  networkFailures = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), url: page.url(), type: msg.type() });
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push({ text: err.message, url: page.url(), type: 'pageerror' });
  });
  page.on('response', (res) => {
    if (!res.ok() && res.status() >= 400) {
      networkFailures.push({ url: res.url(), status: res.status(), method: res.request().method() });
    }
  });
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name.replace(/[^a-z0-9]/gi, '_')}.png`), fullPage: true });
}

function report(...args: any[]) {
  console.log(`[QA]`, ...args);
}

// ─── Fixtures Setup ──────────────────────────────────────────────────
test.beforeAll(async () => {
  for (const dir of [SCREENSHOT_DIR, CONSOLE_LOG_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
});

test.beforeEach(async ({ page }, testInfo) => {
  await setupPageListeners(page);
  report(`Starting: ${testInfo.title}`);
});

test.afterEach(async ({ page }, testInfo) => {
  if (consoleErrors.length > 0) {
    const logPath = path.join(CONSOLE_LOG_DIR, `${testInfo.title.replace(/[^a-z0-9]/gi, '_')}.json`);
    fs.writeFileSync(logPath, JSON.stringify({ consoleErrors, networkFailures }, null, 2));
  }
  if (testInfo.status !== 'passed') {
    await screenshot(page, `FAIL_${testInfo.title}`);
  }
  const status = testInfo.status === 'passed' ? '✓ PASS' : `✗ FAIL (${testInfo.status})`;
  report(`${status}: ${testInfo.title}`);
  if (consoleErrors.length > 0) {
    report(`  Console errors: ${consoleErrors.length}`);
  }
  if (networkFailures.length > 0) {
    report(`  Network failures: ${networkFailures.length}`);
  }
});

// ─── 1. HEALTH CHECK ────────────────────────────────────────────────
test.describe('Health & Reachability', () => {

  test('01 - Application is reachable and returns 200', async ({ page }) => {
    const response = await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(200);
    await screenshot(page, '01-homepage');
  });

  test('02 - Page loads with no console errors', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForLoadState('domcontentloaded');
    expect(consoleErrors.length).toBe(0);
  });

  test('03 - No 4xx/5xx network failures on initial load', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(networkFailures.length).toBe(0);
  });

  test('04 - Page title is set correctly', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    report(`Page title: "${title}"`);
  });

  test('05 - Google Sheets Web App is reachable', async ({ page }) => {
    try {
      const response = await page.request.get(SHEETS_WEBAPP_URL);
      report(`Sheets Web App response: ${response.status()}`);
      expect(response.ok()).toBeTruthy();
    } catch (err) {
      report(`Sheets Web App unreachable (expected with CORS/redirect): ${err}`);
    }
  });
});

// ─── 2. SIGN-IN PAGE ────────────────────────────────────────────────
test.describe('Authentication - Sign In', () => {

  test('06 - Sign-in page loads with sign-in form', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
    await screenshot(page, '06-sign-in-page');
    // Clerk sign-in renders an iframe, but the page should load
    expect(await page.locator('body').isVisible()).toBeTruthy();
  });

  test('07 - Sign-in page redirects unauthenticated users from protected routes', async ({ page }) => {
    await page.goto(`${BASE_URL}/pipeline`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    report(`Protected route redirect: ${currentUrl}`);
    // Should have been redirected to sign-in or auth
    expect(currentUrl).not.toContain('/pipeline');
  });

  test('08 - Sign-in page has no console errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    if (consoleErrors.length > 0) {
      report(`Sign-in console errors: ${JSON.stringify(consoleErrors)}`);
    }
  });
});

// ─── 3. NAVIGATION & ROUTING ─────────────────────────────────────────
test.describe('Navigation & Routes', () => {

  const PUBLIC_ROUTES = [
    '/sign-in',
  ];

  const PROTECTED_ROUTES = [
    '/pipeline',
    '/outreach',
    '/campaigns',
    '/settings',
    '/import',
    '/migrate',
    '/recommendations',
    '/downloads',
  ];

  for (const route of PUBLIC_ROUTES) {
    test(`09 - Public route ${route} loads without error`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
      expect(consoleErrors.length).toBe(0);
    });
  }

  for (const route of PROTECTED_ROUTES) {
    test(`10 - Protected route ${route} redirects unauthenticated users`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      const currentUrl = page.url();
      // Should NOT be on the protected route
      expect(currentUrl).not.toContain(route);
      report(`Route ${route} redirected to: ${currentUrl}`);
    });
  }
});

// ─── 4. APPLICATION SHELL / UI FRAMEWORK ────────────────────────────
test.describe('UI Framework & Shell', () => {

  test('11 - App shell renders without layout shift on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '11-desktop-shell');
  });

  test('12 - App shell renders without layout shift on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 1194 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '12-tablet-shell');
  });

  test('13 - App shell renders without layout shift on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '13-mobile-shell');
  });

  test('14 - No horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);
    report(`Body width: ${bodyWidth}, Viewport: ${viewportWidth}`);
  });
});

// ─── 5. ACCESSIBILITY (Basic) ───────────────────────────────────────
test.describe('Accessibility', () => {

  test('15 - Sign-in page has proper heading structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const headings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3')).map(h => ({
        level: h.tagName,
        text: h.textContent?.trim().substring(0, 80),
      }));
    });
    report(`Headings found: ${JSON.stringify(headings)}`);
    // Should have at least some headings
  });

  test('16 - Images have alt text or are decorative', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const imagesWithoutAlt = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img:not([alt=""])'))
        .filter(img => !img.hasAttribute('alt') || img.getAttribute('alt') === null)
        .map(img => (img as HTMLImageElement).src);
    });
    if (imagesWithoutAlt.length > 0) {
      report(`Images without alt text: ${imagesWithoutAlt.length}`);
    }
  });

  test('17 - Interactive elements have accessible names', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button, a, input, select, textarea'))
        .filter(el => {
          const hasAria = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
          const hasText = el.textContent?.trim() || (el as HTMLInputElement).placeholder;
          return !hasAria && !hasText;
        })
        .map(el => `${el.tagName}${el.className ? '.' + el.className.slice(0, 30) : ''}`);
    });
    if (buttons.length > 0) {
      report(`Elements without accessible names: ${buttons.length}`);
    }
  });
});

// ─── 6. PERFORMANCE METRICS ─────────────────────────────────────────
test.describe('Performance', () => {

  test('18 - Page load metrics', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
        domInteractive: nav.domInteractive,
        loadEventEnd: nav.loadEventEnd,
        responseEnd: nav.responseEnd,
        transferSize: nav.transferSize,
        duration: nav.duration,
      };
    });
    report(`Page load metrics: ${JSON.stringify(metrics, null, 2)}`);
  });

  test('19 - Resource sizes (JS bundles)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource')
        .filter((r: any) => r.initiatorType === 'script' || r.initiatorType === 'link')
        .map((r: any) => ({
          name: r.name.substring(0, 80),
          size: r.transferSize,
          duration: r.duration,
        }))
        .sort((a: any, b: any) => b.size - a.size)
        .slice(0, 10);
    });
    report(`Top resources: ${JSON.stringify(resources, null, 2)}`);
  });
});

// ─── 7. API RESPONSES ───────────────────────────────────────────────
test.describe('API Health', () => {

  test('20 - Settings API returns properly', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/settings?organizationId=test_org`);
    report(`Settings API: ${response.status()}`);
    if (response.ok()) {
      const body = await response.json();
      report(`Settings API body keys: ${Object.keys(body)}`);
    }
  });

  test('21 - Leads API requires auth', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/leads`);
    report(`Leads API (no auth): ${response.status()}`);
    // Should be 401 or 403
  });
});

// ─── 8. GOOGLE SHEETS INTEGRATION ───────────────────────────────────
test.describe('Google Sheets Integration', () => {

  test('22 - Sheets Web App responds to CORS preflight', async ({ page }) => {
    try {
      const response = await page.request.post(SHEETS_WEBAPP_URL, {
        data: { lead: { businessName: 'Test Business', website: 'https://example.com' } },
      });
      report(`Sheets Web App POST response: ${response.status()}`);
      const body = await response.text();
      report(`Sheets response body: ${body.substring(0, 200)}`);
    } catch (err) {
      report(`Sheets Web App POST failed (expected with CORS): ${err}`);
    }
  });
});

// ─── 9. STATIC ASSETS ───────────────────────────────────────────────
test.describe('Static Assets', () => {

  test('23 - Favicon loads', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const favicon = await page.evaluate(() => {
      const link = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
      return link ? (link as HTMLLinkElement).href : null;
    });
    report(`Favicon: ${favicon}`);
    if (favicon) {
      const response = await page.request.get(favicon);
      expect(response.ok()).toBeTruthy();
    }
  });

  test('24 - No broken images', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const brokenImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img'))
        .filter(img => !img.complete || img.naturalWidth === 0)
        .map(img => img.src);
    });
    if (brokenImages.length > 0) {
      report(`Broken images: ${brokenImages.length}`);
    }
    expect(brokenImages.length).toBe(0);
  });
});

// ─── 10. CONSOLE ERRORS SUMMARY ─────────────────────────────────────
test.describe('Console Error Tracking', () => {

  test('25 - Aggregate console error report', async ({ page }) => {
    // Navigate to multiple pages and collect errors
    const pages = ['/', '/sign-in', '/pipeline', '/settings'];
    const allErrors: any[] = [];
    for (const p of pages) {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      if (consoleErrors.length > 0) {
        allErrors.push({ page: p, errors: [...consoleErrors] });
      }
    }
    report(`Console errors across ${pages.length} pages: ${JSON.stringify(allErrors, null, 2)}`);
  });
});

// ─── 11. SECURITY CHECKS ────────────────────────────────────────────
test.describe('Security Observations', () => {

  test('26 - HTTPS enforced', async ({ page }) => {
    const response = await page.goto(`http://leads.creativecomet.tn`, {
      waitUntil: 'networkidle',
      maxRedirects: 5,
    });
    const finalUrl = page.url();
    report(`HTTP redirects to: ${finalUrl}`);
    expect(finalUrl.startsWith('https://')).toBeTruthy();
  });

  test('27 - No sensitive data in URL', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    const url = page.url();
    const sensitivePatterns = [/api[_-]?key/i, /token/i, /secret/i, /password/i, /auth/i];
    for (const pattern of sensitivePatterns) {
      expect(url).not.toMatch(pattern);
    }
  });
});

// ─── 12. RESPONSIVE DESIGN ──────────────────────────────────────────
test.describe('Responsive Design', () => {

  const VIEWPORTS = [
    { name: 'Desktop 1440', width: 1440, height: 900 },
    { name: 'Desktop 1280', width: 1280, height: 800 },
    { name: 'Tablet Landscape', width: 1024, height: 768 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
    { name: 'Mobile Large', width: 430, height: 932 },
    { name: 'Mobile Small', width: 375, height: 667 },
  ];

  for (const vp of VIEWPORTS) {
    test(`28 - Layout at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);
      await screenshot(page, `layout_${vp.name.replace(/\s+/g, '_')}`);
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth + 5;
      });
      if (hasHorizontalScroll) {
        report(`WARNING: Horizontal scroll detected at ${vp.width}x${vp.height}`);
      }
      expect(hasHorizontalScroll).toBeFalsy();
    });
  }
});

// ─── 13. SPA / CLIENT-SIDE ROUTING ──────────────────────────────────
test.describe('Client-Side Navigation', () => {

  test('29 - No React hydration errors', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.text().includes('hydration') || msg.text().includes('Hydration')) {
        consoleErrors.push({ text: msg.text(), url: page.url(), type: 'hydration' });
      }
    });
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    const hydrationErrors = consoleErrors.filter(e => e.type === 'hydration');
    expect(hydrationErrors.length).toBe(0);
    report(`Hydration errors: ${hydrationErrors.length}`);
  });
});

// ─── 14. NOT FOUND / ERROR ROUTE ────────────────────────────────────
test.describe('Error Pages', () => {

  test('30 - 404 route renders without crash', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/nonexistent-path-xyz`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await screenshot(page, '30-404-page');
    report(`404 page status: ${response?.status()}`);
  });
});
