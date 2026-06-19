import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export const pingRouter = Router();

/**
 * POST /api/worker/ping
 *
 * Heartbeat — worker calls this every 30 seconds.
 * Updates lastPing on the active WorkerSession.
 * Marks sessions with no ping in 90s as offline.
 */
pingRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.workerSessionId) {
      await prisma.workerSession.update({
        where: { id: req.workerSessionId },
        data: { lastPing: new Date(), status: 'online' },
      });
    }

    // Mark stale sessions offline
    const staleThreshold = new Date(Date.now() - 90_000);
    await prisma.workerSession.updateMany({
      where: {
        userId: req.userId,
        status: 'online',
        lastPing: { lt: staleThreshold },
        ...(req.workerSessionId ? { id: { not: req.workerSessionId } } : {}),
      },
      data: { status: 'offline' },
    });

    res.json({ ok: true, timestamp: new Date().toISOString(), sessionId: req.workerSessionId });
  } catch (err) {
    console.error('[ping]', err);
    res.status(500).json({ error: 'Ping failed' });
  }
});
