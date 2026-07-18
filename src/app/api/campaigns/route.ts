import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { workspaceId } = await requireAuth(req);
    const campaigns = await prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      include: { ledgerEntries: true },
    });
    return NextResponse.json(campaigns);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, userId } = await requireAuth(req);
    const body = await req.json();

    const { id, name, channel, status, createdAt } = body;
    const campaign = await prisma.campaign.create({
      data: {
        id: id || undefined,
        workspaceId,
        name,
        channel: channel || 'email',
        status: status || 'draft',
        createdById: userId,
        createdAt: createdAt ? new Date(createdAt) : undefined,
      },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
