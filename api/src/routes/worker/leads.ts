import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { broadcastToUser } from '../../lib/supabase';

export const leadsRouter = Router();

const LeadSchema = z.object({
  name:          z.string().min(1).max(500),
  address:       z.string().max(500).default(''),
  phone:         z.string().max(100).default(''),
  website:       z.string().max(500).default(''),
  email:         z.string().max(500).default(''),
  googleMapsUrl: z.string().url().optional().nullable(),
  rating:        z.number().min(0).max(5).optional().nullable(),
  reviewCount:   z.number().int().min(0).optional().nullable(),
  category:      z.string().max(200).default(''),
  city:          z.string().max(200).default(''),
  businessType:  z.string().max(200).default(''),
  latitude:      z.number().optional().nullable(),
  longitude:     z.number().optional().nullable(),
  plusCode:      z.string().max(50).optional().nullable(),
  photoCount:    z.number().int().min(0).optional().nullable(),
  openingHours:  z.record(z.string()).optional().nullable(),
  attributes:    z.array(z.string()).optional().nullable(),
  popularTimes:  z.record(z.unknown()).optional().nullable(),
  sessionId:     z.string().uuid().optional().nullable(),
});

const BulkSchema = z.object({
  leads: z.array(LeadSchema).min(1).max(50),
});

/**
 * GET /api/worker/leads/find?googleMapsUrl=...
 *
 * Lets the scraping engine look up a lead's DB id by its Google Maps URL.
 * Uses worker token auth (not dashboard JWT) so the engine can call it directly.
 */
leadsRouter.get('/find', async (req: Request, res: Response): Promise<void> => {
  const googleMapsUrl = req.query.googleMapsUrl as string;
  if (!googleMapsUrl) {
    res.status(400).json({ error: 'googleMapsUrl query param required' });
    return;
  }
  try {
    const lead = await prisma.business.findFirst({
      where: { userId: req.userId, googleMapsUrl },
      select: { id: true, name: true, googleMapsUrl: true },
    });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json({ id: lead.id, name: lead.name, googleMapsUrl: lead.googleMapsUrl });
  } catch (err) {
    console.error('[worker/leads/find]', err);
    res.status(500).json({ error: 'Failed to find lead' });
  }
});

/**
 * POST /api/worker/leads
 *
 * Bulk upsert leads from the desktop worker.
 * Deduplicates by (userId, googleMapsUrl).
 * Broadcasts realtime events to the dashboard after insert.
 */
leadsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = BulkSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() });
    return;
  }

  const { leads } = parsed.data;
  const userId = req.userId;
  let inserted = 0, updated = 0, skipped = 0;
  const insertedLeads: Array<{ id: string; name: string; city: string }> = [];

  for (const lead of leads) {
    try {
      const commonData = {
        name:         lead.name,
        address:      lead.address,
        phone:        lead.phone,
        website:      lead.website,
        email:        lead.email,
        rating:       lead.rating    != null ? new Prisma.Decimal(lead.rating)    : null,
        reviewCount:  lead.reviewCount ?? null,
        category:     lead.category,
        city:         lead.city,
        businessType: lead.businessType,
        latitude:     lead.latitude  != null ? new Prisma.Decimal(lead.latitude)  : null,
        longitude:    lead.longitude != null ? new Prisma.Decimal(lead.longitude) : null,
        plusCode:     lead.plusCode  ?? null,
        photoCount:   lead.photoCount ?? null,
        // Use Prisma.JsonNull for null JSON fields — avoids type errors
        openingHours: lead.openingHours != null
          ? (lead.openingHours as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        attributes: lead.attributes != null
          ? (lead.attributes as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        popularTimes: lead.popularTimes != null
          ? (lead.popularTimes as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        sessionId: lead.sessionId ?? null,
      };

      if (lead.googleMapsUrl) {
        const existing = await prisma.business.findFirst({
          where: { userId, googleMapsUrl: lead.googleMapsUrl },
          select: { id: true },
        });

        if (existing) {
          await prisma.business.update({ where: { id: existing.id }, data: commonData });
          updated++;
        } else {
          const created = await prisma.business.create({
            data: { userId, googleMapsUrl: lead.googleMapsUrl, ...commonData },
          });
          inserted++;
          insertedLeads.push({ id: created.id, name: created.name, city: created.city });
        }
      } else {
        const created = await prisma.business.create({ data: { userId, ...commonData } });
        inserted++;
        insertedLeads.push({ id: created.id, name: created.name, city: created.city });
      }
    } catch (err) {
      console.error(`[worker/leads] Failed to upsert "${lead.name}":`, err);
      skipped++;
    }
  }

  // Update session lead count
  const sessionId = leads.find((l) => l.sessionId)?.sessionId;
  if (sessionId && inserted > 0) {
    prisma.scrapingSession
      .update({ where: { id: sessionId }, data: { leadsCollected: { increment: inserted } } })
      .catch(() => {});
  }

  // Broadcast new leads to dashboard
  if (insertedLeads.length > 0) {
    broadcastToUser(userId, 'leads:new', {
      count: insertedLeads.length,
      leads: insertedLeads,
    }).catch(() => {});
  }

  res.status(201).json({ ok: true, inserted, updated, skipped, total: leads.length });
});
