import { Page } from 'playwright';
import { humanType, humanWait, humanScroll, humanMouseMove } from './human';

export interface ScrapedLead {
  name: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  googleMapsUrl: string;
  rating: number | null;
  reviewCount: number | null;
  category: string;
  latitude: number | null;
  longitude: number | null;
}

/** Prioritised selector list for the Maps search box */
const SEARCH_SELECTORS = [
  '#searchboxinput',
  'input[aria-label*="Search"]',
  '#searchbox input',
];

async function findSearchBox(page: Page): Promise<string | null> {
  for (const sel of SEARCH_SELECTORS) {
    try {
      await page.waitForSelector(sel, { timeout: 3000 });
      return sel;
    } catch { /* try next */ }
  }
  return null;
}

/** Execute a search on Google Maps */
export async function executeSearch(
  page: Page,
  businessType: string,
  city: string,
  onStatus: (msg: string) => void
): Promise<boolean> {
  const sel = await findSearchBox(page);
  if (!sel) { onStatus('ERROR: Could not find Maps search box'); return false; }

  const query = `${businessType} in ${city}`;
  onStatus(`Searching: "${query}"`);

  // Clear and type
  await page.click(sel, { clickCount: 3 });
  await humanWait(200, 400);
  await humanType(page, sel, query);
  await humanWait(400, 800);
  await page.keyboard.press('Enter');

  // Wait for results panel
  try {
    await page.waitForSelector('[role="feed"], .m6QErb', { timeout: 15000 });
  } catch {
    // Retry once
    onStatus('Results panel timeout — retrying...');
    await humanWait(2000, 3000);
    await page.keyboard.press('Enter');
    try {
      await page.waitForSelector('[role="feed"], .m6QErb', { timeout: 15000 });
    } catch {
      onStatus('ERROR: No results panel found');
      return false;
    }
  }

  // Check for no results
  const noResults = await page.$('[class*="noResults"], [class*="no-results"]');
  if (noResults) {
    onStatus('No results found for this search. Try a different city or business type.');
    return false;
  }

  await humanWait(1000, 2000);
  onStatus('Search complete — scrolling through results');
  return true;
}

/** Main results collection loop */
export async function collectResults(
  page: Page,
  maxResults: number,
  onStatus: (msg: string) => void,
  onLeadFound: (name: string, address: string) => void
): Promise<ScrapedLead[]> {
  const seen = new Set<string>();
  const results: ScrapedLead[] = [];
  let noNewCount = 0;

  while (results.length < maxResults && noNewCount < 3) {
    // Find all listing anchors with /maps/place/ in href
    const listings = await page.$$eval(
      'a[href*="/maps/place/"]',
      (els) => els.map(el => ({
        href:    (el as HTMLAnchorElement).href,
        name:    el.getAttribute('aria-label') || el.textContent?.trim() || '',
        address: el.querySelector('[class*="address"], [class*="W4Efsd"]')?.textContent?.trim() || '',
        rating:  el.querySelector('[class*="MW4etd"]')?.textContent?.trim() || null,
        reviews: el.querySelector('[class*="UY7F9"]')?.textContent?.replace(/[()]/g,'').trim() || null,
        category:el.querySelector('[class*="DkEaL"]')?.textContent?.trim() || '',
      }))
    );

    const prevSize = seen.size;
    for (const item of listings) {
      if (!item.href || seen.has(item.href)) continue;
      if (results.length >= maxResults) break;
      seen.add(item.href);
      const lead: ScrapedLead = {
        name:         item.name,
        address:      item.address,
        phone:        '',
        website:      '',
        email:        '',
        googleMapsUrl:item.href,
        rating:       item.rating ? parseFloat(item.rating) : null,
        reviewCount:  item.reviews ? parseInt(item.reviews.replace(/,/g,'')) : null,
        category:     item.category,
        latitude:     null,
        longitude:    null,
      };
      results.push(lead);
      onLeadFound(lead.name, lead.address);
    }

    if (seen.size === prevSize) {
      noNewCount++;
    } else {
      noNewCount = 0;
    }

    onStatus(`Collected ${results.length} / ${maxResults} leads`);

    // Scroll the results panel
    const panel = await page.$('[role="feed"], .m6QErb');
    if (panel) {
      await humanScroll(page, 'down', 500, '[role="feed"]');
    } else {
      await humanScroll(page, 'down', 500);
    }
    await humanWait(800, 1800);
  }

  onStatus(`Results collected — ${results.length} businesses found — beginning detail scraping`);
  return results;
}

/** Check for CAPTCHA on the page */
export async function detectCaptcha(page: Page): Promise<boolean> {
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    '#captcha-form',
    '[class*="captcha"]',
    'form[action*="sorry"]',
  ];
  for (const sel of captchaSelectors) {
    const el = await page.$(sel);
    if (el) return true;
  }
  const url = page.url();
  return url.includes('sorry') || url.includes('captcha');
}
