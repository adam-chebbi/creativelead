import { Page } from 'playwright';
import { humanType, humanWait, humanScroll } from './human';

export interface ScrapedLead {
  name:          string;
  address:       string;
  phone:         string;
  website:       string;
  email:         string;
  googleMapsUrl: string;
  rating:        number | null;
  reviewCount:   number | null;
  category:      string;
  latitude:      number | null;
  longitude:     number | null;
}

const SEARCH_SELECTORS = [
  '#searchboxinput',
  'input[aria-label*="Search"]',
  'input[aria-label*="search"]',
  '#searchbox input[type="text"]',
  'input[name="q"]',
];

const RESULTS_PANEL_SELECTORS = [
  '[role="feed"]',
  'div[aria-label*="Results"]',
  '.m6QErb[aria-label]',
  '.m6QErb',
];

async function findSelector(page: Page, selectors: string[], timeout = 3000): Promise<string | null> {
  for (const sel of selectors) {
    try { await page.waitForSelector(sel, { timeout }); return sel; }
    catch { /* try next */ }
  }
  return null;
}

export async function executeSearch(
  page: Page,
  businessType: string,
  city: string,
  onStatus: (msg: string) => void
): Promise<boolean> {
  const sel = await findSelector(page, SEARCH_SELECTORS, 5000);
  if (!sel) {
    onStatus('ERROR: Could not find Maps search box');
    return false;
  }

  const query = `${businessType} in ${city}`;
  onStatus(`Typing search: "${query}"`);

  await page.click(sel, { clickCount: 3 });
  await humanWait(200, 500);
  await humanType(page, sel, query);
  await humanWait(400, 900);
  await page.keyboard.press('Enter');

  onStatus('Waiting for results panel...');

  let panelSel = await findSelector(page, RESULTS_PANEL_SELECTORS, 15000);
  if (!panelSel) {
    onStatus('Results panel timeout — retrying...');
    await humanWait(2000, 3000);
    await page.keyboard.press('Enter');
    panelSel = await findSelector(page, RESULTS_PANEL_SELECTORS, 15000);
    if (!panelSel) { onStatus('ERROR: Results panel not found'); return false; }
  }

  await humanWait(1000, 2000);

  const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
  if (bodyText.includes('no results') || bodyText.includes("didn't find") || bodyText.includes('0 results')) {
    onStatus('No results found. Try a different city or business type.');
    return false;
  }

  if (bodyText.includes('zoom in') || bodyText.includes('search this area')) {
    onStatus('WARN: Results spread across large area — try a more specific city name');
    try {
      const btn = await page.$('button[jsaction*="searchThisArea"], button[aria-label*="Search this area"]');
      if (btn) { await btn.click(); await humanWait(1500, 2500); }
    } catch { /* ignore */ }
  }

  await humanWait(1000, 2000);
  onStatus('Search complete — scrolling through results');
  return true;
}

export async function collectResults(
  page: Page,
  maxResults: number,
  onStatus: (msg: string) => void,
  onLeadFound: (name: string, address: string) => void
): Promise<ScrapedLead[]> {
  const seen    = new Set<string>();
  const results: ScrapedLead[] = [];
  let noNewCount = 0;

  while (results.length < maxResults && noNewCount < 3) {
    const listings = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'));
      return anchors.map(el => {
        const a = el as HTMLAnchorElement;
        const name =
          a.getAttribute('aria-label') ||
          a.querySelector('[class*="fontHeadlineSmall"], [class*="qBF1Pd"]')?.textContent?.trim() ||
          a.textContent?.trim() || '';
        const address =
          a.querySelector('[class*="W4Efsd"] [class*="W4Efsd"]:last-child')?.textContent?.trim() ||
          a.querySelector('[class*="UaQhfb"]')?.textContent?.trim() || '';
        const ratingEl = a.querySelector('[class*="MW4etd"]');
        const rating = ratingEl ? parseFloat(ratingEl.textContent?.trim() || '0') || null : null;
        const reviewEl = a.querySelector('[class*="UY7F9"]');
        const reviewText = reviewEl?.textContent?.replace(/[()\s,]/g, '') || '';
        const reviewCount = reviewText ? parseInt(reviewText) || null : null;
        const category =
          a.querySelector('[class*="DkEaL"]')?.textContent?.trim() ||
          a.querySelector('[class*="W4Efsd"]:first-child')?.textContent?.trim() || '';
        return { href: a.href, name, address, rating, reviewCount, category };
      }).filter(item => item.href && item.name);
    });

    const prevSize = seen.size;
    for (const item of listings) {
      if (seen.has(item.href) || results.length >= maxResults) continue;
      seen.add(item.href);
      results.push({
        name: item.name, address: item.address, phone: '', website: '', email: '',
        googleMapsUrl: item.href, rating: item.rating, reviewCount: item.reviewCount,
        category: item.category, latitude: null, longitude: null,
      });
      onLeadFound(item.name, item.address);
    }

    if (seen.size === prevSize) noNewCount++;
    else noNewCount = 0;

    onStatus(`Collected ${results.length} / ${maxResults} leads — scrolling...`);

    const panelSel = await findSelector(page, RESULTS_PANEL_SELECTORS, 2000);
    if (panelSel) await humanScroll(page, 'down', 500, panelSel);
    else await humanScroll(page, 'down', 500);
    await humanWait(800, 1800);
  }

  onStatus(`Results collected — ${results.length} businesses found — beginning detail scraping`);
  return results;
}

export async function detectCaptcha(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.includes('sorry') || url.includes('captcha') || url.includes('recaptcha')) return true;
  for (const sel of ['iframe[src*="recaptcha"]', '#captcha-form', 'form[action*="sorry"]']) {
    try { const el = await page.$(sel); if (el) return true; } catch { /* ignore */ }
  }
  return false;
}
