import { Page } from 'playwright';
import { humanWait, humanScroll } from './human';

export interface ScrapedReview {
  authorName:     string;
  authorImageUrl: string | null;
  rating:         number | null;
  text:           string;
  publishedAt:    string | null;
}

export async function navigateToReviews(
  page: Page,
  onStatus: (msg: string) => void
): Promise<boolean> {
  try {
    // Try direct selectors first
    const tabSelectors = [
      'button[aria-label*="Reviews"]',
      'button[data-tab-index="1"]',
      '[role="tab"][aria-label*="Review"]',
    ];

    let clicked = false;
    for (const sel of tabSelectors) {
      try {
        const tab = await page.$(sel);
        if (tab) { await tab.click(); clicked = true; break; }
      } catch { /* try next */ }
    }

    // Fallback: scan all tabs for "Review" text
    if (!clicked) {
      const tabs = await page.$$('[role="tab"], button[jsaction]');
      for (const tab of tabs) {
        const text = await tab.textContent();
        if (text?.toLowerCase().includes('review')) {
          await tab.click(); clicked = true; break;
        }
      }
    }
    if (!clicked) return false;

    await page.waitForSelector(
      '[data-review-id], [class*="jftiEf"], [class*="GHT2ce"]',
      { timeout: 8000 }
    );
    await humanWait(800, 1500);

    // Sort by Newest
    const sortSelectors = [
      'button[aria-label*="Sort"]',
      'button[data-value*="sort"]',
      '[jsaction*="sortBy"]',
      '[aria-label*="Most relevant"]',
    ];
    for (const sel of sortSelectors) {
      try {
        const sortBtn = await page.$(sel);
        if (!sortBtn) continue;
        await sortBtn.click();
        await humanWait(400, 800);
        // Find Newest option
        const opts = await page.$$('[data-index], li, [role="menuitem"]');
        for (const opt of opts) {
          const text = await opt.textContent();
          if (text?.toLowerCase().includes('newest') || text?.toLowerCase().includes('recent')) {
            await opt.click();
            await humanWait(1000, 2000);
            onStatus('Sorted reviews by newest');
            return true;
          }
        }
        break;
      } catch { /* try next */ }
    }

    onStatus('WARN: Could not sort reviews — using default order');
    return true;
  } catch {
    return false;
  }
}

export async function collectReviews(
  page: Page,
  businessName: string,
  onStatus: (msg: string) => void
): Promise<ScrapedReview[]> {
  const reviews: ScrapedReview[] = [];
  let lastCount = 0;
  let noNewCount = 0;
  const TARGET = 50;

  while (reviews.length < TARGET && noNewCount < 2) {
    const rawReviews = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll('[data-review-id], [class*="jftiEf"], [class*="GHT2ce"]')
      );
      return els.map((el, idx) => {
        const authorName =
          el.querySelector('[class*="d4r55"], [class*="NhBTye"], [class*="X43Kjb"]')?.textContent?.trim() || '';
        const imgEl = el.querySelector('img[src*="googleusercontent"], img[src*="ggpht"]') as HTMLImageElement | null;
        const authorImageUrl = imgEl?.src || null;

        // Rating: aria-label strategy (most reliable)
        const starContainer = el.querySelector('[aria-label*="star"], [aria-label*="Star"], [class*="kvMYJc"]');
        let rating: number | null = null;
        if (starContainer) {
          const label = starContainer.getAttribute('aria-label') || '';
          const m = label.match(/(\d+(?:\.\d+)?)/);
          if (m) rating = parseFloat(m[1]);
        }
        // Fallback: count filled star elements
        if (!rating) {
          const filled = el.querySelectorAll('[class*="hCCjke"], [class*="elGi1d"], [class*="fzvQIb"]').length;
          if (filled > 0 && filled <= 5) rating = filled;
        }

        const textEl = el.querySelector('[class*="wiI7pd"], [class*="MyEned"], [class*="review-full-text"]');
        const text = textEl?.textContent?.trim() || '';
        const dateEl = el.querySelector('[class*="rsqaWe"], [class*="xRkPPb"], [class*="dehysf"]');
        const publishedAt = dateEl?.textContent?.trim() || null;

        return { idx, authorName, authorImageUrl, rating, text, publishedAt };
      });
    });

    // Dedup by DOM position index — not by author name
    for (const r of rawReviews) {
      if (r.idx >= reviews.length && reviews.length < TARGET) {
        reviews.push({
          authorName:     r.authorName || `Reviewer ${r.idx + 1}`,
          authorImageUrl: r.authorImageUrl,
          rating:         r.rating,
          text:           r.text,
          publishedAt:    r.publishedAt,
        });
      }
    }

    if (reviews.length === lastCount) noNewCount++;
    else noNewCount = 0;
    lastCount = reviews.length;

    if (reviews.length >= TARGET) break;

    await humanScroll(page, 'down', 400);
    await humanWait(600, 1200);
  }

  onStatus(`Reviews collected for ${businessName} — ${reviews.length} reviews found`);
  return reviews.slice(0, TARGET);
}
