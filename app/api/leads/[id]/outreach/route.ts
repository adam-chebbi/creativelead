import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAndPersistMessage, generateAllMessagesForLead, batchGenerateMessages } from '@/utils/outreach-server';
import { incrementCounter } from '@/lib/quota';

const CHANNEL_MAP: Record<string, string> = {
  email: 'email',
  linkedin: 'linkedin',
  whatsapp: 'whatsapp',
  proposalIntro: 'proposal_intro',
  phoneScript: 'phoneScript',
};

const CHANNEL_MAP_REVERSE: Record<string, string> = {
  email: 'email',
  linkedin: 'linkedin',
  whatsapp: 'whatsapp',
  proposal_intro: 'proposalIntro',
  phoneScript: 'phoneScript',
};

async function fetchMessagesForLead(leadId: string, workspaceId?: string) {
  const where: any = { leadId };
  if (workspaceId) where.lead = { workspaceId };
  const records = await prisma.outreachMessage.findMany({
    where,
  });
  const messages: Record<string, { subject?: string; body: string; edited: boolean }> = {};
  for (const r of records) {
    const key = CHANNEL_MAP_REVERSE[r.channel] || r.channel;
    messages[key] = { subject: r.subject || undefined, body: r.body, edited: r.editedByHuman };
  }
  return messages;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let userId, workspaceId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    workspaceId = authContext.workspaceId;
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { channel, leadIds, provider, model, apiKey, apiBase } = body;

    if (!provider || !model || !apiKey) {
      return NextResponse.json({ error: 'AI provider, model, and apiKey are required' }, { status: 400 });
    }

    const aiConfig = { provider, model, apiKey, apiBase };

    // Batch generation across leads
    if (leadIds && Array.isArray(leadIds)) {
      const result = await batchGenerateMessages(leadIds, workspaceId, aiConfig);
      incrementCounter(workspaceId, 'outreach_generations', leadIds.length).catch(() => {});
      return NextResponse.json(result);
    }

    // Single channel for a single lead
    if (channel) {
      const validChannels = ['email', 'linkedin', 'whatsapp', 'proposalIntro', 'phoneScript'];
      if (!validChannels.includes(channel)) {
        return NextResponse.json({ error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` }, { status: 400 });
      }
      const genResult = await generateAndPersistMessage(params.id, workspaceId, channel as any, aiConfig);
      if (genResult.editedBlocked) {
        return NextResponse.json({ editedBlocked: true, error: genResult.error }, { status: 409 });
      }
      if (!genResult.ok) {
        return NextResponse.json({ error: genResult.error || 'Generation failed' }, { status: 500 });
      }
      incrementCounter(workspaceId, 'outreach_generations').catch(() => {});
      const allMessages = await fetchMessagesForLead(params.id, workspaceId);
      return NextResponse.json({ ok: true, messages: allMessages });
    }

    // All channels for a single lead
    const genResult = await generateAllMessagesForLead(params.id, workspaceId, aiConfig);
    incrementCounter(workspaceId, 'outreach_generations').catch(() => {});
    const allMessages = await fetchMessagesForLead(params.id, workspaceId);
    return NextResponse.json({ ok: true, messages: allMessages, results: genResult.results });
  } catch (error) {
    console.error('[OUTREACH_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
