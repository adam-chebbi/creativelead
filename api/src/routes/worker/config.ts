import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export const configRouter = Router();

/**
 * GET /api/worker/config
 *
 * Returns pending/paused scraping jobs and scroll delay settings.
 * Worker polls this at session start and on manual refresh.
 */
configRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [jobs, settings] = await Promise.all([
      prisma.scrapingJob.findMany({
        where: { userId: req.userId, status: { in: ['pending', 'paused'] } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, city: true, businessType: true, maxResults: true, scrapeReviews: true, status: true, createdAt: true },
      }),
      prisma.userSettings.findUnique({
        where: { userId: req.userId },
        select: { scrollDelayMin: true, scrollDelayMax: true },
      }),
    ]);

    res.json({
      jobs,
      settings: {
        scrollDelayMin:     settings?.scrollDelayMin  ?? 800,
        scrollDelayMax:     settings?.scrollDelayMax  ?? 1800,
        pageLoadWait:       3000,
        resultsPerSession:  200,
      },
    });
  } catch (err) {
    console.error('[config]', err);
    res.status(500).json({ error: 'Failed to fetch config' });
  }
});
