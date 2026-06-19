import fs from 'fs';
import os from 'os';

/**
 * Detects the user's installed real browser executable path.
 * Priority: Chrome > Edge > Brave > Chromium (fallback).
 * Returns null if none found — engine falls back to Playwright bundled Chromium.
 *
 * This is the key to the "watch it work" feature:
 * the user sees THEIR OWN browser open and navigate, not a foreign window.
 */
export function detectUserBrowser(): string | null {
  const platform = os.platform();
  const candidates: string[] = [];

  if (platform === 'win32') {
    candidates.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      `${os.homedir()}\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe`,
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      `${os.homedir()}\\AppData\\Local\\BraveSoftware\\Brave-Browser\\Application\\brave.exe`,
    );
  } else if (platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      `${os.homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    );
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/brave-browser',
      '/snap/bin/chromium',
      '/usr/bin/microsoft-edge',
    );
  }

  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch { /* skip */ }
  }
  return null;
}

export function getBrowserName(executablePath: string | null): string {
  if (!executablePath) return 'Playwright Chromium (bundled)';
  const lower = executablePath.toLowerCase();
  if (lower.includes('brave'))    return 'Brave';
  if (lower.includes('edge'))     return 'Microsoft Edge';
  if (lower.includes('chrome'))   return 'Google Chrome';
  if (lower.includes('chromium')) return 'Chromium';
  return 'Browser';
}
