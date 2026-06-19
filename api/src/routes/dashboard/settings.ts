import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../../lib/prisma';

export const settingsRouter = Router();

const UpdateSchema = z.object({
  emailTemplate:         z.string().max(10000).optional(),
  followupStep3Enabled:  z.boolean().optional(),
  followupStep7Enabled:  z.boolean().optional(),
  followupStep14Enabled: z.boolean().optional(),
  followupStep3Days:     z.number().int().min(1).max(60).optional(),
  followupStep7Days:     z.number().int().min(1).max(60).optional(),
  followupStep14Days:    z.number().int().min(1).max(60).optional(),
  scrollDelayMin:        z.number().int().min(200).max(10000).optional(),
  scrollDelayMax:        z.number().int().min(200).max(10000).optional(),
  defaultLanguage:       z.enum(['english','greek','arabic']).optional(),
  resendApiKey:          z.string().max(200).optional(),
  resendFromEmail:       z.string().email().max(200).optional(),
  groqApiKey:            z.string().max(200).optional(),
});

/** GET /api/dashboard/settings — returns settings (API keys masked) */
settingsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const s = await prisma.userSettings.findUnique({ where: { userId: req.userId } });
    res.json({
      emailTemplate:         s?.emailTemplate         ?? null,
      followupStep3Enabled:  s?.followupStep3Enabled  ?? true,
      followupStep7Enabled:  s?.followupStep7Enabled  ?? true,
      followupStep14Enabled: s?.followupStep14Enabled ?? true,
      followupStep3Days:     s?.followupStep3Days     ?? 3,
      followupStep7Days:     s?.followupStep7Days     ?? 7,
      followupStep14Days:    s?.followupStep14Days    ?? 14,
      scrollDelayMin:        s?.scrollDelayMin        ?? 800,
      scrollDelayMax:        s?.scrollDelayMax        ?? 1800,
      defaultLanguage:       s?.defaultLanguage       ?? 'english',
      hasResendKey:          !!s?.resendApiKey,
      hasGroqKey:            !!s?.groqApiKey,
      resendFromEmail:       s?.resendFromEmail       ?? null,
    });
  } catch (err) {
    console.error('[settings GET]', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/** PATCH /api/dashboard/settings */
settingsRouter.patch('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() }); return; }
  try {
    await prisma.userSettings.upsert({
      where:  { userId: req.userId },
      create: { userId: req.userId, ...parsed.data },
      update: parsed.data,
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings PATCH]', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

/** GET /api/dashboard/settings/worker-token */
settingsRouter.get('/worker-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { workerToken: true } });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ workerToken: user.workerToken });
  } catch (err) {
    console.error('[settings/worker-token]', err);
    res.status(500).json({ error: 'Failed to fetch token' });
  }
});

/** POST /api/dashboard/settings/regenerate-token */
settingsRouter.post('/regenerate-token', async (req: Request, res: Response): Promise<void> => {
  try {
    const newToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({ where: { id: req.userId }, data: { workerToken: newToken } });
    await prisma.workerSession.updateMany({ where: { userId: req.userId, status: 'online' }, data: { status: 'offline' } });
    res.json({
      ok: true,
      workerToken: newToken,
      message: 'Token regenerated. All connected workers disconnected. This is the only time the full token will be shown.',
    });
  } catch (err) {
    console.error('[settings/regenerate-token]', err);
    res.status(500).json({ error: 'Failed to regenerate token' });
  }
});

/** POST /api/dashboard/settings/jobs — create a scraping job */
settingsRouter.post('/jobs', async (req: Request, res: Response): Promise<void> => {
  const JobSchema = z.object({
    city:          z.string().min(1).max(200),
    businessType:  z.string().min(1).max(200),
    maxResults:    z.number().int().min(1).max(2000).default(200),
    scrapeReviews: z.boolean().default(true),
  });
  const parsed = JobSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() }); return; }
  try {
    const job = await prisma.scrapingJob.create({ data: { userId: req.userId, ...parsed.data } });
    res.status(201).json({ ok: true, job });
  } catch (err) {
    console.error('[settings/jobs POST]', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/** DELETE /api/dashboard/settings/jobs/:id */
settingsRouter.delete('/jobs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await prisma.scrapingJob.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    await prisma.scrapingJob.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings/jobs DELETE]', err);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});
