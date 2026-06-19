import { Page } from 'playwright';
import { humanWait, humanMouseMove, humanType } from './human';

/**
 * Session warm-up: google.com -> optional random browse -> maps.google.com
 * Makes the session look like a normal user who ended up on Maps.
 */
export async function warmupSession(page: Page, onStatus: (msg: string) => void): Promise<void> {
  onStatus('Navigating to Google...');
  await humanWait(800, 1500);
  await page.goto('https://www.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await humanWait(1500, 3000);

  // Accept cookie consent if present
  const consentSelectors = ['button[id*="accept"]', 'button[aria-label*="Accept"]', '#L2AGLb', '.QS5gu'];
  for (const sel of consentSelectors) {
    try {
      const btn = await page.$(sel);
      if (btn) { await btn.click(); await humanWait(500, 1000); break; }
    } catch { /* ignore */ }
  }

  // Move mouse around the page
  await humanMouseMove(page);
  await humanWait(1000, 2000);
  await humanMouseMove(page);

  // 30% chance: click a random headline and go back
  if (Math.random() < 0.3) {
    try {
      const links = await page.$$('a[href*="//"]');
      if (links.length > 3) {
        const link = links[Math.floor(Math.random() * Math.min(links.length, 8))];
        await link.click();
        await humanWait(3000, 7000);
        await page.goBack();
        await humanWait(1000, 2000);
      }
    } catch { /* ignore */ }
  }

  // 20% chance: type a random search query
  if (Math.random() < 0.2) {
    try {
      const queries = ['local restaurants', 'coffee shops near me', 'best dentist', 'plumber services'];
      const q = queries[Math.floor(Math.random() * queries.length)];
      const searchBox = await page.$('input[name="q"]');
      if (searchBox) {
        await humanType(page, 'input[name="q"]', q);
        await page.keyboard.press('Enter');
        await humanWait(2000, 4000);
        await page.goBack();
        await humanWait(1000, 2000);
      }
    } catch { /* ignore */ }
  }

  // Navigate to Google Maps
  onStatus('Navigating to Google Maps...');
  await humanWait(800, 1500);
  await page.goto('https://maps.google.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for Maps search box
  await page.waitForSelector('#searchboxinput, input[aria-label*="Search"]', { timeout: 20000 });
  await humanWait(1000, 2000);
  await humanMouseMove(page);

  onStatus('Ready — Google Maps loaded');
}
