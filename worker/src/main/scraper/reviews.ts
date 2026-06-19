import { Page } from 'playwright';
import { humanClick, humanWait, humanScroll } from './human';

export interface ScrapedReview {
  authorName:     string;
  authorImageUrl: string | null;
  rating:         number | null;
  text:           string;
  publishedAt:    string | null;
}

/** Extract star rating from a review element using multiple strategies */
async function extractRating(page: Page, reviewEl: Element): Promise<number | null> {
  // Strategy 1: aria-label on star container
  const ariaLabel = reviewEl.querySelector('[aria-label*="star"], [aria-label*="Star"]')?.getAttribute('aria-label');
  if (ariaLabel) {
    const match = ariaLabel.match(/(\d+(?:\.\d+)?)/);
    if (match) return parseFloat(match[1]);
  }
  // Strategy 2: count filled star SVGs
  const filledStars = reviewEl.querySelectorAll('[class*="hCCjke"], [class*="elGi1d"]').length;
  if (filledStars > 0 && filledStars <= 5) return filledStars;
  // Strategy 3: data-rating attribute
  const dataRating = (reviewEl as HTMLElement).dataset?.rating;
  if (dataRating) return parseFloat(dataRating);
  return null;
}

/** Navigate to the Reviews tab and sort by Newest */
export async function navigateToReviews(
  page: Page,
  onStatus: (msg: string) => void
): Promise<boolean> {
  try {
    // Find and click Reviews tab
    const tabs = await page.$$('[role="tab"], button[aria-label*="Review"]');
    let clicked = false;
    for (const tab of tabs) {
      const text = await tab.textContent();
      if (text?.toLowerCase().includes('review')) {
        await tab.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) return false;

    await page.waitForSelector('[data-review-id], [class*="jftiEf"]', { timeout: 8000 });
    await humanWait(800, 1500);

    // Sort by Newest
    const sortBtn = await page.$('[data-value*="sort"], [aria-label*="Sort"], button[jsaction*="sortBy"]');
    if (sortBtn) {
      await sortBtn.click();
      await humanWait(400, 800);
      const newestOpt = await page.$('[data-index="1"], [data-value="newestFirst"], li:nth-child(2)');
      if (newestOpt) {
        await newestOpt.click();
        await humanWait(1000, 2000);
        onStatus('Sorted reviews by newest');
      }
    }
    return true;
  } catch {
    return false;
  }
}

/** Scroll and collect up to 50 reviews */
export async function collectReviews(
  page: Page,
  businessName: string,
  onStatus: (msg: string) => void
): Promise<ScrapedReview[]> {
  const reviews: ScrapedReview[] = [];
  const seenAuthors = new Set<string>();
  let noNewCount = 0;

  while (reviews.length < 50 && noNewCount < 2) {
    const reviewEls = await page.$$('[data-review-id], [class*="jftiEf"]');
    const prevCount = reviews.length;

    for (const el of reviewEls) {
      if (reviews.length >= 50) break;
      const authorName = await el.$eval('[class*="d4r55"], [class*="NhBTye"]', e => e.textContent?.trim() || '').catch(() => '');
      if (!authorName || seenAuthors.has(authorName)) continue;
      seenAuthors.add(authorName);

      const authorImageUrl = await el.$eval('img', e => (e as HTMLImageElement).src || null).catch(() => null);
      const text = await el.$eval('[class*="wiI7pd"], [class*="MyEned"]', e => e.textContent?.trim() || '').catch(() => '');
      const publishedAt = await el.$eval('[class*="rsqaWe"], [class*="xRkPPb"]', e => e.textContent?.trim() || null).catch(() => null);

      // Extract rating from DOM element
      const ratingEl = await el.$('[aria-label*="star"], [class*="hCCjke"]');
      let rating: number | null = null;
      if (ratingEl) {
        const ariaLabel = await ratingEl.getAttribute('aria-label');
        if (ariaLabel) {
          const m = ariaLabel.match(/(\d+(?:\.\d+)?)/); 
          if (m) rating = parseFloat(m[1]);
        }
      }

      reviews.push({ authorName, authorImageUrl, rating, text, publishedAt });
    }

    if (reviews.length === prevCount) noNewCount++;
    else noNewCount = 0;

    await humanScroll(page, 'down', 400);
    await humanWait(600, 1200);
  }

  onStatus(`Reviews collected for ${businessName} — ${reviews.length} reviews found`);
  return reviews;
}
