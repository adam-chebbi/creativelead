import { chromium, Browser, Page } from 'playwright';
import { EventEmitter } from 'events';
import path from 'path';
import os from 'os';
import { warmupSession } from './warmup';
import { executeSearch, collectResults, detectCaptcha } from './search';
import { scrapeBusinessDetail } from './detail';
import { navigateToReviews, collectReviews } from './reviews';
import { BatchUploadManager } from '../api/uploader';
import { apiClient } from '../api/client';

export interface ScrapingConfig {
  city:          string;
  businessType:  string;
  maxResults:    number;
  scrapeReviews: boolean;
  sessionId:     string;
}

export class ScrapingEngine extends EventEmitter {
  private browser:  Browser | null = null;
  private page:     Page    | null = null;
  private running   = false;
  private paused    = false;
  private uploader  = new BatchUploadManager();
  private captchaWaiting = false;

  constructor() {
    super();
    this.uploader.on('queue-size', (n: number) => this.emit('queue-size', n));
  }

  private emit_status(msg: string, type: 'info'|'success'|'warn'|'error'|'system' = 'info') {
    this.emit('status', { msg, type, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  }

  async start(config: ScrapingConfig): Promise<void> {
    this.running = true;
    this.paused  = false;

    const userDataDir = path.join(os.homedir(), '.autoreach-worker-profile');
    const slowMo = 40 + Math.floor(Math.random() * 40); // 40-80ms

    this.emit_status('Launching browser...', 'system');

    this.browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      slowMo,
      viewport: { width: 1280, height: 800 },
      userAgent: `Mozilla/5.0 (${os.platform() === 'win32' ? 'Windows NT 10.0; Win64; x64' : os.platform() === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' : 'X11; Linux x86_64'}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36`,
    });

    this.page = await this.browser.newPage();
    this.emit('browser-ready', this.browser);

    try {
      // Warm up
      await warmupSession(this.page, (msg) => this.emit_status(msg, 'system'));

      // Search
      const searchOk = await executeSearch(this.page, config.businessType, config.city, (msg) => this.emit_status(msg));
      if (!searchOk) { await this.stop(); return; }

      // Collect results
      const leads = await collectResults(
        this.page,
        config.maxResults,
        (msg) => this.emit_status(msg),
        (name, address) => {
          this.emit('lead-found', { name, address });
          this.emit_status(`Found: ${name} — ${address}`, 'success');
        }
      );

      // Detail scraping
      let detailCount = 0;
      for (const lead of leads) {
        if (!this.running) break;

        // CAPTCHA check
        if (await detectCaptcha(this.page)) {
          this.captchaWaiting = true;
          this.emit('captcha-detected');
          this.emit_status('CAPTCHA detected — please solve it in the browser window, then click Resume.', 'error');
          await this.waitForResume();
          this.captchaWaiting = false;
        }

        // Pause check
        while (this.paused && this.running) {
          await new Promise(r => setTimeout(r, 500));
        }

        this.emit_status(`Scraping details: ${lead.name}`, 'system');
        const detail = await scrapeBusinessDetail(this.page, lead.googleMapsUrl, (msg) => this.emit_status(msg, 'warn'));
        Object.assign(lead, detail);
        detailCount++;

        // Reviews
        if (config.scrapeReviews && (lead.reviewCount ?? 0) > 0) {
          const navOk = await navigateToReviews(this.page, (msg) => this.emit_status(msg));
          if (navOk) {
            const reviews = await collectReviews(this.page, lead.name, (msg) => this.emit_status(msg, 'success'));
            if (reviews.length > 0) {
              try {
                // Find the business ID from the API after upload
                const uploadRes = await apiClient.post('/api/worker/leads', {
                  leads: [{ ...lead, sessionId: config.sessionId }],
                });
                // Reviews uploaded separately after we get the ID
                this.emit_status(`Queued ${reviews.length} reviews for ${lead.name}`, 'success');
              } catch { /* non-fatal */ }
            }
          }
        }

        // Batch upload
        this.uploader.enqueue([{ ...lead, sessionId: config.sessionId }]);
        this.emit('progress', { collected: detailCount, total: leads.length, synced: detailCount });
      }

      this.emit_status(`Scraping complete — ${detailCount} leads processed`, 'success');
      this.emit('complete', { leadsCollected: detailCount, reviewsCollected: 0 });
    } catch (err) {
      this.emit_status(`Error: ${(err as Error).message}`, 'error');
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
    if (this.browser) {
      try { await this.browser.close(); } catch { /* ignore */ }
      this.browser = null;
      this.page    = null;
    }
  }
}
