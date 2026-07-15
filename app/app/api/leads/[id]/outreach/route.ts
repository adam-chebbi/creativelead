import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAndPersistMessage, generateAllMessagesForLead, batchGenerateMessages } from '@/utils/outreach-server';

const CHANNEL_MAP_REVERSE: Record<string, string> = {
  email: 'email',
  linkedin: 'linkedin',
  whatsapp: 'whatsapp',
  proposal_intro: 'proposalIntro',
};

async function fetchMessagesForLead(leadId: string) {
  const records = await prisma.outreachMessage.findMany({
    where: { leadId },
  });
  const messages: Record<string, { subject?: string; body: string; edited: boolean }> = {};
  for (const r of records) {
    const key = CHANNEL_MAP_REVERSE[r.channel] || r.channel;
    messages[key] = { subject: r.subject || undefined, body: r.body, edited: r.editedByHuman };
  }
  return messages;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let userId, orgId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    orgId = authContext.orgId;
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

    if (leadIds && Array.isArray(leadIds)) {
      const result = await batchGenerateMessages(leadIds, orgId, aiConfig);
      return NextResponse.json(result);
    }

    if (channel) {
      const validChannels = ['email', 'linkedin', 'whatsapp', 'proposalIntro'];
      if (!validChannels.includes(channel)) {
        return NextResponse.json({ error: `Invalid channel. Must be one of: ${validChannels.join(', ')}` }, { status: 400 });
      }
      const result = await generateAndPersistMessage(params.id, orgId, channel as any, aiConfig);
      if (result.editedBlocked) {
        return NextResponse.json({ editedBlocked: true, error: result.error }, { status: 409 });
      }
      if (!result.ok) {
        return NextResponse.json({ error: result.error || 'Generation failed' }, { status: 500 });
      }
      const allMessages = await fetchMessagesForLead(params.id);
      return NextResponse.json({ ok: true, messages: allMessages });
    }

    const result = await generateAllMessagesForLead(params.id, orgId, aiConfig);
    const allMessages = await fetchMessagesForLead(params.id);
    return NextResponse.json({ ok: true, messages: allMessages, results: result.results });
  } catch (error) {
    console.error('[OUTREACH_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
