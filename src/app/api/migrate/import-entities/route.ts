import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAuth(req);
    const body = await req.json();
    const counts = { notes: 0, attachments: 0, followUps: 0, campaigns: 0, ledgerEntries: 0 };

    if (Array.isArray(body.notes)) {
      for (const n of body.notes) {
        const lead = await prisma.lead.findFirst({
          where: { businessName: n.leadUrl ? undefined : undefined },
        });
        if (!lead) continue;
        await prisma.leadNote.create({
          data: { leadId: lead.id, authorId: userId, body: n.text || n.body || '' },
        });
        counts.notes++;
      }
    }

    if (Array.isArray(body.attachments)) {
      for (const a of body.attachments) {
        const lead = await prisma.lead.findFirst({ where: { businessName: a.leadUrl || '' } });
        if (!lead) continue;
        await prisma.leadAttachment.create({
          data: { leadId: lead.id, fileUrl: a.data || a.fileUrl || '', uploadedById: userId },
        });
        counts.attachments++;
      }
    }

    if (Array.isArray(body.followUps)) {
      for (const f of body.followUps) {
        const lead = await prisma.lead.findFirst({ where: { businessName: f.leadUrl || '' } });
        if (!lead) continue;
        await prisma.followUp.create({
          data: {
            leadId: lead.id,
            dueAt: new Date(f.dueAt || Date.now()),
            assignedToId: userId,
            status: f.completed ? 'completed' : 'pending',
          },
        });
        counts.followUps++;
      }
    }

    if (Array.isArray(body.campaigns)) {
      for (const c of body.campaigns) {
        await prisma.campaign.upsert({
          where: { id: c.id || 'none' },
          update: { name: c.name, channel: c.channel || 'email', status: c.status || 'draft' },
          create: {
            id: c.id || undefined,
            workspaceId: (await requireAuth(req)).workspaceId,
            name: c.name,
            channel: c.channel || 'email',
            status: c.status || 'draft',
            createdById: userId,
          },
        });
        counts.campaigns++;
      }
    }

    if (Array.isArray(body.ledgerEntries)) {
      for (const e of body.ledgerEntries) {
        try {
          await prisma.campaignLedgerEntry.create({
            data: {
              id: e.id || undefined,
              campaignId: e.campaignId,
              leadUrl: e.leadUrl || null,
              channel: e.channel || null,
              status: e.status || 'pending',
              nextScheduledAt: e.nextScheduledAt ? new Date(e.nextScheduledAt) : null,
              sentAt: e.sentAt ? new Date(e.sentAt) : null,
              errorMessage: e.errorMessage || null,
            },
          });
          counts.ledgerEntries++;
        } catch {
          // skip entries referencing campaigns that don't exist yet
        }
      }
    }

    return NextResponse.json({ ok: true, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
