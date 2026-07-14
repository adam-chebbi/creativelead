import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const updateSchema = z.object({
  pipelineStage: z.string().optional(),
  ownerId: z.string().optional().nullable(),
  aiScore: z.number().optional().nullable(),
  classification: z.string().optional().nullable(),
}).strict();

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
