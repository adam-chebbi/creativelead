import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { scoreLeadById, shouldRescoreOnUpdate } from '@/utils/score-lead-server';

const updateSchema = z.object({
  pipelineStage: z.string().optional(),
  ownerId: z.string().optional().nullable(),
  aiScore: z.number().optional().nullable(),
  classification: z.string().optional().nullable(),
  opportunityScore: z.number().optional().nullable(),
  competitionScore: z.number().optional().nullable(),
  growthScore: z.number().optional().nullable(),
  seoWeakness: z.number().optional().nullable(),
  websiteQuality: z.number().optional().nullable(),
  reviewReputation: z.number().optional().nullable(),
  aiScoreLastComputed: z.string().datetime().optional().nullable(),
  aiScoreInputsHash: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  businessName: z.string().optional(),
  category: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  rating: z.number().optional().nullable(),
  reviewCount: z.number().int().optional().nullable(),
}).strict();

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  let orgId;
  try {
    const authContext = await requireAuth(req);
    orgId = authContext.orgId;
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  try {
    const lead = await prisma.lead.findFirst({
      where: { id: params.id, organizationId: orgId },
      include: { notes: true, followUps: true, attachments: true, stageHistory: true },
    });
    if (!lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(lead);
  } catch (error) {
    console.error('[LEAD_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  let userId, orgId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    orgId = authContext.orgId;
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.lead.findFirst({
      where: { id: params.id, organizationId: orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updated = await prisma.lead.update({
      where: { id: params.id },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    if (shouldRescoreOnUpdate(
      { rating: existing.rating, reviewCount: existing.reviewCount, website: existing.website, category: existing.category, city: existing.city },
      { rating: data.rating, reviewCount: data.reviewCount, website: data.website, category: data.category, city: data.city },
    )) {
      scoreLeadById(params.id, orgId).catch((err) =>
        console.error(`[LEAD_PATCH] rescore failed for ${params.id}:`, err)
      );
    }

    if (data.pipelineStage && data.pipelineStage !== existing.pipelineStage) {
      await prisma.pipelineStageEntry.create({
        data: {
          leadId: params.id,
          stage: data.pipelineStage,
          movedById: userId,
        },
      });
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          actorId: userId,
          action: 'lead.stage_changed',
          targetType: 'lead',
          targetId: params.id,
          metadata: { from: existing.pipelineStage, to: data.pipelineStage },
        },
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('[LEAD_PATCH]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  let userId, orgId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    orgId = authContext.orgId;
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const existing = await prisma.lead.findFirst({
      where: { id: params.id, organizationId: orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.lead.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'lead.deleted',
        targetType: 'lead',
        targetId: params.id,
        metadata: { businessName: existing.businessName },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LEAD_DELETE]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
