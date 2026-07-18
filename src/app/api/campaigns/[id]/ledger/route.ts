import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const campaign = await prisma.campaign.findFirst({ where: { id: params.id, workspaceId } });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const entries = await prisma.campaignLedgerEntry.findMany({
      where: { campaignId: params.id },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(entries);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const campaign = await prisma.campaign.findFirst({ where: { id: params.id, workspaceId } });
    if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    const entry = await prisma.campaignLedgerEntry.create({
      data: {
        id: body.id || undefined,
        campaignId: params.id,
        leadUrl: body.leadUrl || null,
        businessName: body.businessName || null,
        channel: body.channel || null,
        recipient: body.recipient || null,
        status: body.status || 'pending',
        subject: body.subject || null,
        body: body.body || null,
        nextScheduledAt: body.nextScheduledAt ? new Date(body.nextScheduledAt) : null,
        sentAt: body.sentAt ? new Date(body.sentAt) : null,
        errorMessage: body.errorMessage || null,
      },
    });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
