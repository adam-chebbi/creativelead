import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { workspaceId } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const stage = searchParams.get('stage');

    const where: Record<string, unknown> = { workspaceId };
    if (stage) where.pipelineStage = stage;

    const leads = await prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(leads);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
