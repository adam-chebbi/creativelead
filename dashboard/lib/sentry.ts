// Sentry/LogRocket Integration Stub
// TODO: When ready to deploy to production, install @sentry/nextjs and initialize it here.

export function initSentry() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;

  // import * as Sentry from '@sentry/nextjs';
  // Sentry.init({
  //   dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  //   tracesSampleRate: 1.0,
  // });
  console.log('[Sentry] Initialized (stub)');
}

export function captureException(error: Error) {
  // import * as Sentry from '@sentry/nextjs';
  // Sentry.captureException(error);
  console.error('[Sentry Stub] Caught error:', error);
}
