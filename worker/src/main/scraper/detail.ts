import { Page } from 'playwright';
import { humanWait, humanMouseMove } from './human';
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

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch {
    onStatus(`WARN: Navigation timeout for ${url.slice(0, 60)}`);
    return {};
  }

  try {
    await page.waitForSelector('h1', { timeout: 10000 });
  } catch {
    onStatus(`WARN: Page load timeout — skipping`);
    return {};
  }

  await humanWait(600, 1200);
  await humanMouseMove(page);

  const detail = await page.evaluate(() => {
    // Phone — try multiple strategies
    const phoneByDataId = document.querySelector('[data-item-id*="phone"] [class*="Io6YTe"]');
    const phoneByTel    = document.querySelector('a[href^="tel:"]') as HTMLAnchorElement | null;
    const phone =
      phoneByDataId?.textContent?.trim() ||
      phoneByTel?.href?.replace('tel:', '') ||
      phoneByTel?.textContent?.trim() || '';

    // Website
    const websiteByDataId = document.querySelector('[data-item-id*="authority"] a') as HTMLAnchorElement | null;
    const website = websiteByDataId?.href || '';

    // Rating (detail page shows larger number)
    const ratingEl = document.querySelector('[class*="fontDisplayLarge"], [class*="F7nice"] [aria-hidden]');
    const rating = ratingEl ? parseFloat(ratingEl.textContent?.trim() || '0') || null : null;

    // Review count
    const reviewEl = document.querySelector('[class*="F7nice"] span[aria-label], [class*="HHrUdb"]');
    const reviewRaw = reviewEl?.getAttribute('aria-label') || reviewEl?.textContent || '';
    const reviewCount = reviewRaw ? parseInt(reviewRaw.replace(/[^0-9]/g, '')) || null : null;

    // Category
    const category =
      document.querySelector('[class*="DkEaL"]')?.textContent?.trim() ||
      document.querySelector('button[jsaction*="category"]')?.textContent?.trim() || '';

    // Address
    const address =
      document.querySelector('[data-item-id*="address"] [class*="Io6YTe"]')?.textContent?.trim() ||
      document.querySelector('[class*="rogA2c"]')?.textContent?.trim() || '';

    // Plus code
    const plusCode =
      document.querySelector('[data-item-id*="oloc"] [class*="Io6YTe"]')?.textContent?.trim() || null;

    // Photo count
    const photoBtn = document.querySelector('button[aria-label*="photo"], button[aria-label*="Photo"]');
    const photoMatch = photoBtn?.getAttribute('aria-label')?.match(/(\d[\d,]*)/);
    const photoCount = photoMatch ? parseInt(photoMatch[1].replace(/,/g, '')) : null;

    // Attributes (amenities like Dine-in, Takeout, Wi-Fi)
    const attrEls = document.querySelectorAll(
      '[class*="E0DTEd"] span, [aria-label*="Has "], [aria-label*="Offers "], [class*="iP2t7d"] span'
    );
    const attributes = Array.from(attrEls)
      .map(el => el.textContent?.trim() || '')
      .filter(Boolean)
      .slice(0, 20);

    return { phone, website, rating, reviewCount, category, address, plusCode, photoCount, attributes };
  });

  // Opening hours — find and click the expand button safely
  let openingHours: Record<string, string> | null = null;
  try {
    // Try to find hours toggle button
    const hoursBtnSelectors = [
      '[data-item-id*="oh"] button',
      '[aria-label*="hours"] button',
      '[aria-label*="Hours"] button',
      'button[data-item-id*="oh"]',
    ];
    for (const sel of hoursBtnSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        await humanWait(300, 600);
        break;
      }
    }

    openingHours = await page.evaluate(() => {
      const rows = document.querySelectorAll(
        '[class*="y0skZc"] tr, table[class*="eK4R0e"] tr, [class*="mxowUb"] tr'
      );
      const hours: Record<string, string> = {};
      rows.forEach(row => {
        const day  = row.querySelector('td:first-child, th:first-child')?.textContent?.trim();
        const time = row.querySelector('td:last-child, td:nth-child(2)')?.textContent?.trim();
        if (day && time && day !== time) hours[day] = time;
      });
      return Object.keys(hours).length > 0 ? hours : null;
    });
  } catch { /* hours not available — non-fatal */ }

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
