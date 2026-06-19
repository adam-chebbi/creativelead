import { Page } from 'playwright';
import { humanClick, humanWait, humanMouseMove } from './human';
import type { ScrapedLead } from './search';

export interface DetailedLead extends ScrapedLead {
  plusCode:     string | null;
  photoCount:   number | null;
  openingHours: Record<string, string> | null;
  attributes:   string[] | null;
  popularTimes: Record<string, unknown> | null;
}

/** Extract full business details from a Google Maps business page */
export async function scrapeBusinessDetail(
  page: Page,
  url: string,
  onStatus: (msg: string) => void
): Promise<Partial<DetailedLead>> {
  await humanWait(1200, 2500);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  try {
    await page.waitForSelector('h1', { timeout: 10000 });
  } catch {
    onStatus(`WARN: Page load timeout for ${url}`);
    return {};
  }

  await humanWait(500, 1000);
  await humanMouseMove(page);

  const detail = await page.evaluate(() => {
    const getText = (sel: string) => document.querySelector(sel)?.textContent?.trim() || '';
    const getAttr = (sel: string, attr: string) => (document.querySelector(sel) as HTMLElement)?.getAttribute(attr) || '';

    // Phone
    const phoneEl = document.querySelector('[data-item-id*="phone"] [class*="Io6YTe"], a[href^="tel:"]');
    const phone = phoneEl ? (phoneEl.textContent?.trim() || (phoneEl as HTMLAnchorElement).href?.replace('tel:','') || '') : '';

    // Website
    const websiteEl = document.querySelector('[data-item-id*="authority"] a, a[data-item-id*="authority"]');
    const website = (websiteEl as HTMLAnchorElement)?.href || '';

    // Rating
    const ratingEl = document.querySelector('[class*="fontDisplayLarge"]');
    const rating = ratingEl ? parseFloat(ratingEl.textContent?.trim() || '0') : null;

    // Review count
    const reviewEl = document.querySelector('[class*="F7nice"] span[aria-label]');
    const reviewCount = reviewEl ? parseInt(reviewEl.getAttribute('aria-label')?.replace(/[^0-9]/g,'') || '0') : null;

    // Category
    const category = getText('[class*="DkEaL"]') || getText('button[jsaction*="category"]');

    // Address
    const address = getText('[data-item-id*="address"] [class*="Io6YTe"]');

    // Plus code
    const plusCode = getText('[data-item-id*="oloc"] [class*="Io6YTe"]') || null;

    // Photo count
    const photoBtn = document.querySelector('button[aria-label*="photo"]');
    const photoMatch = photoBtn?.getAttribute('aria-label')?.match(/(\d[\d,]*)/)?.[1];
    const photoCount = photoMatch ? parseInt(photoMatch.replace(/,/g,'')) : null;

    // Attributes
    const attrEls = document.querySelectorAll('[class*="E0DTEd"] span, [aria-label*="Has "], [aria-label*="Offers "]');
    const attributes = Array.from(attrEls).map(el => el.textContent?.trim() || '').filter(Boolean).slice(0, 20);

    return { phone, website, rating, reviewCount, category, address, plusCode, photoCount, attributes };
  });

  // Opening hours — click to expand if collapsed
  let openingHours: Record<string, string> | null = null;
  try {
    const hoursBtn = await page.$('[data-item-id*="oh"] button, [aria-label*="hours"] button, [class*="OMl5r"]');
    if (hoursBtn) {
      await humanClick(page, '[data-item-id*="oh"] button, [aria-label*="hours"] button, [class*="OMl5r"]');
      await humanWait(300, 600);
    }
    openingHours = await page.evaluate(() => {
      const rows = document.querySelectorAll('[class*="y0skZc"] tr, table[class*="eK4R0e"] tr');
      const hours: Record<string, string> = {};
      rows.forEach(row => {
        const day  = row.querySelector('td:first-child')?.textContent?.trim();
        const time = row.querySelector('td:last-child')?.textContent?.trim();
        if (day && time) hours[day] = time;
      });
      return Object.keys(hours).length > 0 ? hours : null;
    });
  } catch { /* hours not available */ }

  return {
    phone:        detail.phone        || '',
    website:      detail.website      || '',
    rating:       detail.rating       ?? null,
    reviewCount:  detail.reviewCount  ?? null,
    category:     detail.category     || '',
    address:      detail.address      || '',
    plusCode:     detail.plusCode     || null,
    photoCount:   detail.photoCount   ?? null,
    attributes:   detail.attributes?.length ? detail.attributes : null,
    openingHours: openingHours,
    popularTimes: null,
  };
}
