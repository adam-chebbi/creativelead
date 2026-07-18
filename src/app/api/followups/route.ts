import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const { workspaceId } = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const days = parseInt(searchParams.get('days') || '7', 10);

    const leads = await prisma.lead.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const leadIds = leads.map(l => l.id);

    const now = new Date();
    const where: Record<string, unknown> = { leadId: { in: leadIds } };

    if (type === 'upcoming') {
      const cutoff = new Date(now.getTime() + days * 86400000);
      where.dueAt = { gte: now, lte: cutoff };
    } else if (type === 'overdue') {
      where.dueAt = { lt: now };
      where.status = 'pending';
    }

    const followUps = await prisma.followUp.findMany({
      where,
      orderBy: { dueAt: 'asc' },
    });

    return NextResponse.json(followUps);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
