import { Page } from 'playwright';

/** Random integer between min and max (inclusive) */
function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Wait a random duration between min and max ms */
export function humanWait(min: number, max: number): Promise<void> {
  return new Promise(r => setTimeout(r, rand(min, max)));
}

/** Type text character by character with realistic delays and occasional typos */
export async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  for (const char of text) {
    // 15% chance of a typo
    if (Math.random() < 0.15) {
      const typo = String.fromCharCode(char.charCodeAt(0) + rand(-2, 2));
      await page.keyboard.type(typo, { delay: rand(60, 180) });
      await humanWait(80, 200);
      await page.keyboard.press('Backspace');
      await humanWait(60, 150);
    }
    await page.keyboard.type(char, { delay: rand(60, 180) });
  }
}

/** Click at a random point inside the element's bounding box */
export async function humanClick(page: Page, selector: string) {
  const el = await page.$(selector);
  if (!el) throw new Error(`humanClick: element not found: ${selector}`);
  const box = await el.boundingBox();
  if (!box) throw new Error(`humanClick: no bounding box for: ${selector}`);
  const x = box.x + rand(4, Math.max(5, box.width  - 4));
  const y = box.y + rand(4, Math.max(5, box.height - 4));
  await humanWait(80, 200);
  await page.mouse.move(x, y);
  await humanWait(40, 100);
  await page.mouse.click(x, y);
}

/** Scroll in steps with occasional direction reversal */
export async function humanScroll(
  page: Page,
  direction: 'up' | 'down',
  totalPx: number,
  selector?: string
) {
  let remaining = totalPx;
  while (remaining > 0) {
    const step = rand(80, 200);
    const actual = Math.min(step, remaining);
    const delta = direction === 'down' ? actual : -actual;

    if (selector) {
      await page.evaluate(
        ({ sel, dy }) => { const el = document.querySelector(sel); if (el) el.scrollTop += dy; },
        { sel: selector, dy: delta }
      );
    } else {
      await page.mouse.wheel(0, delta);
    }

    remaining -= actual;
    await humanWait(100, 400);

    // 20% chance of slight reversal
    if (Math.random() < 0.2) {
      const back = rand(30, 60);
      const backDelta = direction === 'down' ? -back : back;
      if (selector) {
        await page.evaluate(
          ({ sel, dy }) => { const el = document.querySelector(sel); if (el) el.scrollTop += dy; },
          { sel: selector, dy: backDelta }
        );
      } else {
        await page.mouse.wheel(0, backDelta);
      }
      await humanWait(80, 200);
    }
  }
}

/** Move mouse in a curved path with 3-5 waypoints */
export async function humanMouseMove(page: Page, targetX?: number, targetY?: number) {
  const viewport = page.viewportSize() ?? { width: 1280, height: 800 };
  const tx = targetX ?? rand(100, viewport.width  - 100);
  const ty = targetY ?? rand(100, viewport.height - 100);
  const steps = rand(3, 5);
  for (let i = 1; i <= steps; i++) {
    const wx = rand(50, viewport.width  - 50);
    const wy = rand(50, viewport.height - 50);
    await page.mouse.move(wx, wy, { steps: rand(5, 15) });
    await humanWait(50, 150);
  }
  await page.mouse.move(tx, ty, { steps: rand(10, 20) });
}
