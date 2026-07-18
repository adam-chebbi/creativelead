import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: Request) {
  let userId, workspaceId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    workspaceId = authContext.workspaceId;
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage');
    const owner = searchParams.get('owner');
    const q = searchParams.get('q');

    const leads = await prisma.lead.findMany({
      where: {
        workspaceId: workspaceId,
        ...(stage ? { pipelineStage: stage } : {}),
        ...(owner ? { ownerId: owner } : {}),
        ...(q ? {
          OR: [
            { businessName: { contains: q, mode: 'insensitive' } },
            { category: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        notes: true,
        followUps: true,
        attachments: true,
        stageHistory: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(leads);
  } catch (error) {
    console.error('[LEADS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
