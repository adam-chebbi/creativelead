// Sentry Integration Stub for Electron Main Process
// TODO: Install @sentry/electron when ready for production

export function initSentry() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.SENTRY_DSN) return;

  // import * as Sentry from '@sentry/electron/main';
  // Sentry.init({
  //   dsn: process.env.SENTRY_DSN,
  // });
  console.log('[Sentry Worker] Initialized (stub)');
}

export function captureException(error: Error) {
  // import * as Sentry from '@sentry/electron/main';
  // Sentry.captureException(error);
  console.error('[Sentry Worker Stub] Caught error:', error);
}
