import { Router, Request, Response } from 'express';
import { prisma } from '../../lib/prisma';

export const pipelineRouter = Router();

const STAGES = ['New', 'Contacted', 'Replied', 'Closed'];

/** GET /api/dashboard/pipeline — leads grouped by stage for Kanban */
pipelineRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const leads = await prisma.business.findMany({
      where: { userId: req.userId, stage: { in: STAGES } },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, address: true, city: true, email: true,
        phone: true, website: true, rating: true, reviewCount: true,
        category: true, stage: true, notes: true, createdAt: true, updatedAt: true,
      },
    });

    const grouped = STAGES.reduce((acc, stage) => {
      acc[stage] = leads.filter((l) => l.stage === stage);
      return acc;
    }, {} as Record<string, typeof leads>);

    const n = grouped['New'].length;
    const c = grouped['Contacted'].length;
    const r = grouped['Replied'].length;
    const cl = grouped['Closed'].length;

    res.json({
      stages: grouped,
      counts: { new: n, contacted: c, replied: r, closed: cl, total: leads.length },
      conversionRates: {
        newToContacted:    Math.round((c  / Math.max(n + c + r + cl, 1)) * 100),
        contactedToReplied:Math.round((r  / Math.max(c + r + cl, 1))    * 100),
        repliedToClosed:   Math.round((cl / Math.max(r + cl, 1))        * 100),
      },
    });
  } catch (err) {
    console.error('[dashboard/pipeline]', err);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});
