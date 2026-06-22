import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export const statsRouter = Router();

/** GET /api/dashboard/stats — overview metrics for the dashboard home */
statsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = req.userId;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  try {
    const [
      totalLeads, leadsWithEmail, emailsSentThisMonth, emailsSentToday,
      stageBreakdown, activeSession, workerStatus, recentLeads,
    ] = await Promise.all([
      prisma.business.count({ where: { userId } }),
      prisma.business.count({ where: { userId, email: { not: '' } } }),
      prisma.sentEmail.count({ where: { userId, sentAt: { gte: startOfMonth }, status: 'sent' } }),
      prisma.sentEmail.count({ where: { userId, sentAt: { gte: startOfToday }, status: 'sent' } }),
      prisma.business.groupBy({ by: ['stage'], where: { userId }, _count: { stage: true } }),
      prisma.scrapingSession.findFirst({
        where: { userId, status: 'running' },
        orderBy: { startedAt: 'desc' },
        select: { id: true, city: true, businessType: true, leadsCollected: true, maxResults: true, startedAt: true },
      }),
      prisma.workerSession.findFirst({
        where: { userId, status: 'online', lastPing: { gte: new Date(Date.now() - 90_000) } },
        orderBy: { lastPing: 'desc' },
        select: { id: true, machineName: true, platform: true, workerVersion: true, lastPing: true },
      }),
      prisma.business.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, name: true, address: true, phone: true, website: true, email: true, category: true, city: true, rating: true, stage: true, createdAt: true },
      }),
    ]);

    res.json({
      totalLeads,
      leadsWithEmail,
      emailsSentThisMonth,
      emailsSentToday,
      stageBreakdown: Object.fromEntries(stageBreakdown.map((s) => [s.stage, s._count.stage])),
      activeSession,
      workerOnline: !!workerStatus,
      workerInfo: workerStatus,
      recentLeads,
    });
  } catch (err) {
    console.error('[dashboard/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});
