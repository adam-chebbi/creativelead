import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

export const reviewsRouter = Router();

const ReviewSchema = z.object({
  authorName:     z.string().max(300),
  authorImageUrl: z.string().url().optional().nullable(),
  rating:         z.number().int().min(1).max(5).optional().nullable(),
  text:           z.string().max(10000).default(''),
  publishedAt:    z.string().max(100).optional().nullable(),
});

const BodySchema = z.object({
  reviews: z.array(ReviewSchema).max(50),
});

/**
 * POST /api/worker/lead/:id/reviews
 *
 * Replace all reviews for a business with the latest 50.
 * Runs as a transaction: delete existing → insert new batch.
 */
reviewsRouter.post('/:id/reviews', async (req: Request, res: Response): Promise<void> => {
  const businessId = req.params.id;

  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const { reviews } = parsed.data;

  try {
    const business = await prisma.business.findFirst({
      where: { id: businessId, userId: req.userId },
      select: { id: true, sessionId: true },
    });
    if (!business) { res.status(404).json({ error: 'Business not found' }); return; }

    await prisma.$transaction([
      prisma.review.deleteMany({ where: { businessId } }),
      prisma.review.createMany({
        data: reviews.map((r) => ({
          businessId,
          authorName:     r.authorName,
          authorImageUrl: r.authorImageUrl ?? null,
          rating:         r.rating ?? null,
          text:           r.text,
          publishedAt:    r.publishedAt ?? null,
        })),
      }),
    ]);

    if (business.sessionId) {
      prisma.scrapingSession
        .update({ where: { id: business.sessionId }, data: { reviewsCollected: { increment: reviews.length } } })
        .catch(() => {});
    }

    res.json({ ok: true, saved: reviews.length });
  } catch (err) {
    console.error('[reviews]', err);
    res.status(500).json({ error: 'Failed to save reviews' });
  }
});
