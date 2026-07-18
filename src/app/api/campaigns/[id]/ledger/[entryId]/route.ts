import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { incrementCounter } from '@/lib/quota';

export async function PATCH(req: NextRequest, { params }: { params: { id: string; entryId: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const campaign = await prisma.campaign.findFirst({ where: { id: params.id, workspaceId } });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.errorMessage !== undefined) data.errorMessage = body.errorMessage;
    if (body.sentAt) data.sentAt = new Date(body.sentAt);
    if (body.nextScheduledAt) data.nextScheduledAt = new Date(body.nextScheduledAt);

    await prisma.campaignLedgerEntry.update({
      where: { id: params.entryId },
      data,
    });
    if (body.status === 'sent') {
      incrementCounter(workspaceId, 'campaign_sends').catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
