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

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — slow down the upload rate.' },
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
app.use('/api', generalLimiter);

// ── Health Check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '2.0.0' });
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
    res.json({ ok: true });
  } catch (err) {
    console.error('[unsubscribe]', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

// ── 404 Handler ───────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global Error Handler ──────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[ERROR]', err.message);
  if (process.env.NODE_ENV !== 'production') console.error(err.stack);
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

    app.listen(PORT, () => {
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
