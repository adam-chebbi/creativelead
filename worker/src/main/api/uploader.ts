import { EventEmitter } from 'events';
import { apiClient } from './client';

interface Lead { [key: string]: unknown; }

export class BatchUploadManager extends EventEmitter {
  private queue: Lead[] = [];
  private uploading = false;
  private retryTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 10;
  private readonly MAX_RETRIES = 3;

  enqueue(leads: Lead[]) {
    this.queue.push(...leads);
    this.emit('queue-size', this.queue.length);
    if (!this.uploading) this.flush();
  }

  private async flush() {
    if (this.uploading || this.queue.length === 0) return;
    this.uploading = true;

    while (this.queue.length > 0) {
      const batch = this.queue.slice(0, this.BATCH_SIZE);
      const success = await this.uploadWithRetry(batch);
      if (success) {
        this.queue.splice(0, this.BATCH_SIZE);
        this.emit('queue-size', this.queue.length);
      } else {
        // Retry entire queue after 30s
        this.uploading = false;
        this.retryTimer = setTimeout(() => this.flush(), 30_000);
        return;
      }
    }

    this.uploading = false;
  }

  private async uploadWithRetry(batch: Lead[]): Promise<boolean> {
    const delays = [2000, 4000, 8000];
    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        await apiClient.post('/api/worker/leads', { leads: batch });
        return true;
      } catch {
        if (attempt < this.MAX_RETRIES) {
          await sleep(delays[attempt]);
        }
      }
    }
    return false;
  }

  clear() {
    this.queue = [];
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.emit('queue-size', 0);
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
