import { chromium, BrowserContext, Page } from 'playwright';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import { warmupSession } from './warmup';
import { executeSearch, collectResults, detectCaptcha } from './search';
import { scrapeBusinessDetail } from './detail';
import { navigateToReviews, collectReviews } from './reviews';
import { BatchUploadManager } from '../api/uploader';
import { apiClient } from '../api/client';
import { detectUserBrowser, getBrowserName } from './browser';

export interface ScrapingConfig {
  city:          string;
  businessType:  string;
  maxResults:    number;
  scrapeReviews: boolean;
  sessionId:     string;
}

export class ScrapingEngine extends EventEmitter {
  private context:  BrowserContext | null = null;
  private page:     Page           | null = null;
  private running   = false;
  private paused    = false;
  private uploader  = new BatchUploadManager();
  private captchaWaiting   = false;
  private reviewsCollected = 0;

  constructor() {
    super();
    this.uploader.on('queue-size', (n: number) => this.emit('queue-size', n));
  }

  private log(msg: string, type: 'info'|'success'|'warn'|'error'|'system' = 'info') {
    this.emit('status', {
      msg, type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
  }

  async start(config: ScrapingConfig): Promise<void> {
    this.running = true;
    this.paused  = false;
    this.reviewsCollected = 0;

    const executablePath = detectUserBrowser();
    const browserName    = getBrowserName(executablePath);
    const slowMo         = 40 + Math.floor(Math.random() * 40); // 40-80ms
    const userDataDir    = path.join(os.homedir(), '.autoreach-worker-profile');

    this.log(`Launching ${browserName}...`, 'system');

    const launchOptions: Parameters<typeof chromium.launchPersistentContext>[1] = {
      headless: false,   // ALWAYS visible — core product feature
      slowMo,
      viewport: { width: 1280, height: 800 },
      userAgent: `Mozilla/5.0 (${
        os.platform() === 'win32'  ? 'Windows NT 10.0; Win64; x64' :
        os.platform() === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' :
        'X11; Linux x86_64'
      }) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36`,
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--disable-extensions-except=',
      ],
    };

    if (executablePath) launchOptions.executablePath = executablePath;

    this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
    this.page    = await this.context.newPage();

    // Remove automation fingerprint from every page
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      // Also spoof plugins length to look like a real browser
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    });

    this.emit('browser-ready');
    this.log(`${browserName} launched — starting warm-up`, 'system');

    try {
      await warmupSession(this.page, (msg) => this.log(msg, 'system'));

      const searchOk = await executeSearch(
        this.page, config.businessType, config.city,
        (msg) => this.log(msg)
      );
      if (!searchOk) { await this.stop(); return; }

      const leads = await collectResults(
        this.page, config.maxResults,
        (msg) => this.log(msg),
        (name, address) => {
          this.emit('lead-found', { name, address });
          this.log(`Found: ${name} — ${address}`, 'success');
        }
      );

      let detailCount = 0;

      for (const lead of leads) {
        if (!this.running) break;

        try {
          // CAPTCHA check before each business
          if (await detectCaptcha(this.page!)) {
            this.captchaWaiting = true;
            this.emit('captcha-detected');
            this.log('CAPTCHA detected — please solve it in the browser window, then click Resume.', 'error');
            await this.waitForResume();
            this.captchaWaiting = false;
          }

          // Pause check
          while (this.paused && this.running) {
            await new Promise(r => setTimeout(r, 500));
          }
          if (!this.running) break;

          this.log(`Scraping details: ${lead.name}`, 'system');
          const detail = await scrapeBusinessDetail(
            this.page!, lead.googleMapsUrl,
            (msg) => this.log(msg, 'warn')
          );
          Object.assign(lead, detail);
          detailCount++;

          // ── Upload lead via worker endpoint (uses worker token auth) ──────────
          let businessDbId: string | null = null;
          try {
            // Upload the lead
            const res = await apiClient.post('/api/worker/leads', {
              leads: [{ ...lead, sessionId: config.sessionId }],
            });

            if (res.data?.updated > 0) {
              this.log(`Lead updated (Duplicate detected): ${lead.name}`, 'info');
            } else if (res.data?.inserted > 0) {
              this.log(`New lead saved: ${lead.name}`, 'success');
            }

            // Look up the DB id using the dedicated worker find endpoint
            if (lead.googleMapsUrl) {
              const findRes = await apiClient.get<{ id: string } | null>(
                '/api/worker/leads/find',
                { params: { googleMapsUrl: lead.googleMapsUrl } }
              );
              businessDbId = findRes.data?.id ?? null;
            }
          } catch (err) {
            this.log(`Upload failed for "${lead.name}": ${(err as Error).message}`, 'warn');
          }

          // ── Scrape & upload reviews ───────────────────────────────────────────
          if (config.scrapeReviews && (lead.reviewCount ?? 0) > 0 && businessDbId) {
            const navOk = await navigateToReviews(this.page!, (msg) => this.log(msg));
            if (navOk) {
              const reviews = await collectReviews(
                this.page!, lead.name,
                (msg) => this.log(msg, 'success')
              );
              if (reviews.length > 0) {
                try {
                  await apiClient.post(`/api/worker/lead/${businessDbId}/reviews`, { reviews });
                  this.reviewsCollected += reviews.length;
                  this.log(`Uploaded ${reviews.length} reviews for ${lead.name}`, 'success');
                } catch (err) {
                  this.log(`Reviews upload failed: ${(err as Error).message}`, 'warn');
                }
              }
            }
          }

          this.emit('progress', {
            collected: detailCount,
            total:     leads.length,
            synced:    detailCount,
          });
        } catch (err: any) {
          const msg = err.message || '';
          if (msg.includes('Target closed') || msg.includes('browser has been closed') || msg.includes('Page closed')) {
            this.log(`Browser crashed or was closed! Attempting auto-restart...`, 'error');
            try {
              if (this.context) await this.context.close().catch(() => {});
              this.context = await chromium.launchPersistentContext(userDataDir, launchOptions);
              this.page = await this.context.newPage();
              await this.context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
              });
              this.log(`Browser restarted successfully. Resuming with next lead...`, 'system');
              continue; // Skip the current lead and move to the next to prevent crash loops on a specific lead
            } catch (restartErr: any) {
              this.log(`Failed to restart browser: ${restartErr.message}`, 'error');
              throw restartErr; // Fatal
            }
          } else {
            throw err; // Other fatal errors
          }
        }
      }

      this.log(`Scraping complete — ${detailCount} leads, ${this.reviewsCollected} reviews`, 'success');
      this.emit('complete', {
        leadsCollected:   detailCount,
        reviewsCollected: this.reviewsCollected,
      });
    } catch (err) {
      this.log(`Fatal error: ${(err as Error).message}`, 'error');
      this.emit('error', err);
    } finally {
      await this.stop();
    }
  }

  private waitForResume(): Promise<void> {
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (!this.captchaWaiting) { clearInterval(check); resolve(); }
      }, 1000);
    });
  }

  resume() { this.captchaWaiting = false; this.paused = false; }
  pause()  { this.paused = true; }

  async stop() {
    this.running = false;
    this.paused  = false;
    this.uploader.clear();
    if (this.context) {
      try { await this.context.close(); } catch { /* ignore */ }
      this.context = null;
      this.page    = null;
    }
  }
}
