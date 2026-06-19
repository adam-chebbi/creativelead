import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { broadcastToUser } from '../../lib/supabase';

export const sessionRouter = Router();

const StartSchema = z.object({
  city:          z.string().min(1).max(200),
  businessType:  z.string().min(1).max(200),
  maxResults:    z.number().int().min(1).max(2000).default(200),
  scrapeReviews: z.boolean().default(true),
});

const EndSchema = z.object({
  sessionId:        z.string().uuid(),
  leadsCollected:   z.number().int().min(0),
  reviewsCollected: z.number().int().min(0),
  endReason:        z.enum(['completed', 'stopped', 'error']),
  durationSeconds:  z.number().int().min(0),
});

/**
 * POST /api/worker/session/start
 * Creates a ScrapingSession and returns its ID.
 */
sessionRouter.post('/start', async (req: Request, res: Response): Promise<void> => {
  const parsed = StartSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const { city, businessType, maxResults, scrapeReviews } = parsed.data;
  const workerVersion = (req.headers['x-worker-version'] as string) || '0.0.0';

  try {
    const session = await prisma.scrapingSession.create({
      data: { userId: req.userId, city, businessType, maxResults, scrapeReviews, status: 'running', workerVersion },
    });

    await broadcastToUser(req.userId, 'session:started', {
      sessionId: session.id, city, businessType, maxResults,
    });

    res.status(201).json({ ok: true, sessionId: session.id, startedAt: session.startedAt });
  } catch (err) {
    console.error('[session/start]', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * POST /api/worker/session/end
 * Finalises a ScrapingSession with stats and end reason.
 */
sessionRouter.post('/end', async (req: Request, res: Response): Promise<void> => {
  const parsed = EndSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const { sessionId, leadsCollected, reviewsCollected, endReason } = parsed.data;

  try {
    const session = await prisma.scrapingSession.findFirst({
      where: { id: sessionId, userId: req.userId },
    });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }

    const statusMap: Record<string, string> = {
      completed: 'completed', stopped: 'stopped', error: 'error',
    };

    const updated = await prisma.scrapingSession.update({
      where: { id: sessionId },
      data: { status: statusMap[endReason], leadsCollected, reviewsCollected, endReason, endedAt: new Date() },
    });

    await broadcastToUser(req.userId, 'session:ended', {
      sessionId, leadsCollected, reviewsCollected, endReason,
    });

    res.json({ ok: true, session: updated });
  } catch (err) {
    console.error('[session/end]', err);
    res.status(500).json({ error: 'Failed to end session' });
  }
});
