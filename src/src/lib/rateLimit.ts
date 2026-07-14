/**
 * In-memory rate limiter (per-user + per-org).
 *
 * Suitable for a single-process dev/staging environment.
 * For production with multiple instances, replace the `store` Map
 * with a Redis-backed counter (e.g. `@upstash/ratelimit`).
 *
 * Usage:
 *   const result = rateLimit({ key: `bulk-import:${userId}`, limit: 10, windowMs: 60_000 });
 *   if (!result.success) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

interface RateLimitOptions {
  /** Unique identifier for this request (e.g. `"bulk-import:userId"`) */
  key: string;
  /** Max requests per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit({ key, limit, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Start a new window
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

/** Purge expired entries to prevent memory leaks in long-running processes. */
export function purgeExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) store.delete(key);
  }
}
