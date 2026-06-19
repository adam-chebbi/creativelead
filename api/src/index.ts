import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { workerRouter } from './routes/worker';
import { dashboardRouter } from './routes/dashboard';
import { startFollowupCron } from './jobs/followupCron';
import { prisma } from './lib/prisma';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ── Security & Middleware ─────────────────────────────────────
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
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

    app.listen(PORT, () => {
      console.log(`[API] AutoReach V2 API Bridge running on port ${PORT}`);
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
