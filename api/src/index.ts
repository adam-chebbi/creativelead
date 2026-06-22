import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { workerRouter } from './routes/worker';
import { dashboardRouter } from './routes/dashboard';
import { resendWebhookRouter } from './routes/webhooks/resend';
import { startFollowupCron } from './jobs/followupCron';
import { prisma } from './lib/prisma';

import { logger } from './lib/logger';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  stream: { write: (message) => logger.info(message.trim(), { context: 'http' }) }
}));

// Webhooks must be mounted before express.json() to preserve the raw body Buffer for signature validation
app.use('/api/webhooks/resend', express.raw({ type: 'application/json' }), resendWebhookRouter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS — allow Next.js dashboard and local dev
const allowedOrigins = [
  process.env.APP_BASE_URL,
  'http://localhost:3000',
  'http://localhost:3001',
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Electron worker, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// ── Rate Limiting ─────────────────────────────────────────────
// Strict limit for worker upload endpoints
const workerUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // reduced from 120
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down the upload rate.' },
});

// Strict limit for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts.' },
});

// General API limiter
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/worker/leads', workerUploadLimiter);
app.use('/api/worker/lead', workerUploadLimiter);
app.use('/api/auth', authLimiter); // Apply to any auth routes
app.use('/api', generalLimiter);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0', db: 'connected' });
  } catch (err: any) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({ status: 'error', timestamp: new Date().toISOString(), version: '2.0.0', db: 'disconnected' });
  }
});

// ── Routes ────────────────────────────────────────────────────
app.use('/api/worker', workerRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/unsubscribe', async (req, res) => {
  const email = req.query.email as string;
  if (!email) { res.status(400).json({ error: 'Missing email' }); return; }
  try {
    await prisma.business.updateMany({
      where: { email },
      data: { unsubscribed: true, stage: 'Unsubscribed' },
    });
    logger.info(`Unsubscribed business`, { email });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error('Failed to unsubscribe', { error: err.message, email });
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(err.message, { stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────
async function main() {
  try {
    await prisma.$connect();
    console.log('[DB] Connected to PostgreSQL via Prisma');

    // Reset any follow-ups that were stuck in processing due to a server restart
    const resetCount = await prisma.followupLog.updateMany({
      where: { status: 'processing' },
      data: { status: 'pending' },
    });
    if (resetCount.count > 0) {
      console.log(`[DB] Reset ${resetCount.count} stuck follow-up jobs to pending`);
    }

    app.listen(PORT, "127.0.0.1", () => {
      console.log(`[API] Creative Leads API Bridge running on port ${PORT}`);
      console.log(`[API] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    startFollowupCron();
    console.log('[CRON] Follow-up scheduler started');
  } catch (err) {
    console.error('[FATAL] Failed to start server:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  console.log('[API] SIGTERM received — shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

main();
