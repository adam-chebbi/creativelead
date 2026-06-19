import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export const sessionsRouter = Router();

/** GET /api/dashboard/sessions — scraping history + connected workers */
sessionsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const page  = parseInt((req.query.page  as string) || '1',  10);
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 100);

  try {
    const [total, sessions, workerSessions] = await Promise.all([
      prisma.scrapingSession.count({ where: { userId: req.userId } }),
      prisma.scrapingSession.findMany({
        where: { userId: req.userId },
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.workerSession.findMany({
        where: { userId: req.userId },
        orderBy: { connectedAt: 'desc' },
        take: 10,
      }),
    ]);

    // Mark stale worker sessions offline
    const staleThreshold = new Date(Date.now() - 90_000);
    const staleIds = workerSessions
      .filter((ws) => ws.status === 'online' && ws.lastPing < staleThreshold)
      .map((ws) => ws.id);

    if (staleIds.length > 0) {
      await prisma.workerSession.updateMany({ where: { id: { in: staleIds } }, data: { status: 'offline' } });
      staleIds.forEach((id) => { const ws = workerSessions.find((w) => w.id === id); if (ws) ws.status = 'offline'; });
    }

    res.json({
      scrapingSessions: { data: sessions, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
      workerSessions,
    });
  } catch (err) {
    console.error('[dashboard/sessions]', err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});
