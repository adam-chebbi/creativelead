import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';

export const leadsRouter = Router();

const QuerySchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(100).default(50),
  search:  z.string().optional(),
  city:    z.string().optional(),
  category:z.string().optional(),
  stage:   z.string().optional(),
  hasEmail:z.enum(['true','false']).optional(),
  dateFrom:z.string().optional(),
  dateTo:  z.string().optional(),
  sortBy:  z.enum(['createdAt','name','rating','reviewCount']).default('createdAt'),
  sortDir: z.enum(['asc','desc']).default('desc'),
});

/** GET /api/dashboard/leads — paginated, filtered, sorted */
leadsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() }); return; }

  const { page, limit, search, city, category, stage, hasEmail, dateFrom, dateTo, sortBy, sortDir } = parsed.data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { userId: req.userId };
  if (search)   where.name     = { contains: search, mode: 'insensitive' };
  if (city)     where.city     = { equals: city, mode: 'insensitive' };
  if (category) where.category = { equals: category, mode: 'insensitive' };
  if (stage)    where.stage    = stage;
  if (hasEmail === 'true')  where.email = { not: '' };
  if (hasEmail === 'false') where.email = '';
  if (dateFrom || dateTo) {
    where.createdAt = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo   ? { lte: new Date(dateTo)   } : {}),
    };
  }

  try {
    const [total, leads] = await Promise.all([
      prisma.business.count({ where }),
      prisma.business.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, address: true, phone: true, website: true,
          email: true, googleMapsUrl: true, rating: true, reviewCount: true,
          category: true, city: true, businessType: true, stage: true,
          notes: true, unsubscribed: true, createdAt: true, updatedAt: true,
          _count: { select: { reviews: true } },
        },
      }),
    ]);

    res.json({
      data: leads,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (err) {
    console.error('[dashboard/leads GET]', err);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

/** GET /api/dashboard/leads/filters — unique cities & categories */
leadsRouter.get('/filters', async (req: Request, res: Response): Promise<void> => {
  try {
    const [cities, categories] = await Promise.all([
      prisma.business.findMany({ where: { userId: req.userId, city: { not: '' } }, select: { city: true }, distinct: ['city'], orderBy: { city: 'asc' } }),
      prisma.business.findMany({ where: { userId: req.userId, category: { not: '' } }, select: { category: true }, distinct: ['category'], orderBy: { category: 'asc' } }),
    ]);
    res.json({ cities: cities.map((c) => c.city), categories: categories.map((c) => c.category) });
  } catch (err) {
    console.error('[dashboard/leads/filters]', err);
    res.status(500).json({ error: 'Failed to fetch filters' });
  }
});

/** GET /api/dashboard/leads/export/csv */
leadsRouter.get('/export/csv', async (req: Request, res: Response): Promise<void> => {
  try {
    const leads = await prisma.business.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } });
    const headers = ['name','address','phone','website','email','category','city','rating','reviewCount','stage','googleMapsUrl','notes','createdAt'];
    const rows = leads.map((l) =>
      headers.map((h) => { const v = (l as Record<string,unknown>)[h]; return `"${String(v ?? '').replace(/"/g,'""')}"`; }).join(',')
    );
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="autoreach-leads-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send([headers.join(','), ...rows].join('\n'));
  } catch (err) {
    console.error('[dashboard/leads/export]', err);
    res.status(500).json({ error: 'Failed to export' });
  }
});

/** GET /api/dashboard/leads/:id — single lead with reviews */
leadsRouter.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await prisma.business.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: {
        reviews: { orderBy: { createdAt: 'desc' }, take: 50 },
        session: { select: { id: true, city: true, businessType: true, startedAt: true } },
      },
    });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    res.json(lead);
  } catch (err) {
    console.error('[dashboard/leads/:id]', err);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

/** PATCH /api/dashboard/leads/:id — update stage, notes, email */
leadsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const VALID_STAGES = ['New','Contacted','Replied','Closed','Unsubscribed'];
  const { stage, notes, email } = req.body as { stage?: string; notes?: string; email?: string };
  if (stage && !VALID_STAGES.includes(stage)) { res.status(400).json({ error: 'Invalid stage' }); return; }
  try {
    const lead = await prisma.business.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    const updated = await prisma.business.update({
      where: { id: req.params.id },
      data: { ...(stage !== undefined ? { stage } : {}), ...(notes !== undefined ? { notes } : {}), ...(email !== undefined ? { email } : {}) },
    });
    res.json({ ok: true, lead: updated });
  } catch (err) {
    console.error('[dashboard/leads/:id PATCH]', err);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

/** DELETE /api/dashboard/leads/:id */
leadsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const lead = await prisma.business.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
    await prisma.business.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[dashboard/leads/:id DELETE]', err);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

/** POST /api/dashboard/leads/bulk-stage */
leadsRouter.post('/bulk-stage', async (req: Request, res: Response): Promise<void> => {
  const VALID_STAGES = ['New','Contacted','Replied','Closed','Unsubscribed'];
  const { ids, stage } = req.body as { ids: string[]; stage: string };
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids must be a non-empty array' }); return; }
  if (!VALID_STAGES.includes(stage)) { res.status(400).json({ error: 'Invalid stage' }); return; }
  try {
    const result = await prisma.business.updateMany({ where: { id: { in: ids }, userId: req.userId }, data: { stage } });
    res.json({ ok: true, updated: result.count });
  } catch (err) {
    console.error('[dashboard/leads/bulk-stage]', err);
    res.status(500).json({ error: 'Failed to bulk update' });
  }
});

/** POST /api/dashboard/leads/bulk-delete */
leadsRouter.post('/bulk-delete', async (req: Request, res: Response): Promise<void> => {
  const { ids } = req.body as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) { res.status(400).json({ error: 'ids must be a non-empty array' }); return; }
  try {
    const result = await prisma.business.deleteMany({ where: { id: { in: ids }, userId: req.userId } });
    res.json({ ok: true, deleted: result.count });
  } catch (err) {
    console.error('[dashboard/leads/bulk-delete]', err);
    res.status(500).json({ error: 'Failed to bulk delete' });
  }
});
