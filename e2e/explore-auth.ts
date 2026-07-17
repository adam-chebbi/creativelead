import { chromium } from 'playwright';

const BASE_URL = 'https://leads.creativecomet.tn';

async function explore() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log('\n=== EXPLORING SIGN-IN PAGE ===');
  await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const html = await page.content();
  console.log('HTML length:', html.length);

  // Find all buttons, inputs, iframes
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.textContent?.trim().substring(0, 100),
      visible: b.offsetParent !== null,
      id: b.id,
      class: b.className.substring(0, 80),
    }));
  });
  console.log('Buttons:', JSON.stringify(buttons, null, 2));

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      type: i.type,
      placeholder: i.placeholder,
      name: i.name,
      id: i.id,
      visible: i.offsetParent !== null,
    }));
  });
  console.log('Inputs:', JSON.stringify(inputs, null, 2));

  // Check for iframes (Clerk uses iframes)
  const iframes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('iframe')).map(f => ({
      src: f.src?.substring(0, 150),
      id: f.id,
      title: f.title,
    }));
  });
  console.log('Iframes:', JSON.stringify(iframes, null, 2));

  const headings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(h => ({
      tag: h.tagName,
      text: h.textContent?.trim().substring(0, 100),
    }));
  });
  console.log('Headings:', JSON.stringify(headings, null, 2));

  await browser.close();
}

explore().catch(console.error);
