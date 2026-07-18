import { prisma } from '@/lib/prisma';

export interface AiOutreachConfig {
  provider: string;
  model: string;
  apiKey: string;
  apiBase?: string;
}

interface LeadContext {
  id: string;
  businessName: string;
  category: string | null;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  enrichment: {
    emails: string[];
    linkedinUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl: string | null;
  } | null;
  opportunity: {
    detectedGaps: any;
    recommendedService: string | null;
    recommendedServiceDetails: string | null;
    conversionProbability: number | null;
  } | null;
}

interface ChannelSpec {
  key: 'email' | 'linkedin' | 'whatsapp' | 'proposalIntro' | 'phoneScript';
  label: string;
  instruction: string;
  requiresSubject: boolean;
}

const OUTREACH_CHANNELS: ChannelSpec[] = [
  {
    key: 'email',
    label: 'Cold Email',
    instruction: 'Write a professional cold email. Include a subject line on the first line prefixed with "Subject:". The body should be 2-3 paragraphs with a clear call to action. Tone: professional, consultative, helpful.',
    requiresSubject: true,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn Message',
    instruction: 'Write a short LinkedIn message (max 300 characters). Conversational tone. No subject line. Reference one specific observation. End with a soft call to action.',
    requiresSubject: false,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Message',
    instruction: 'Write a very short WhatsApp message (max 200 characters). Informal, friendly tone. Extremely concise — like texting a business owner. No subject line.',
    requiresSubject: false,
  },
  {
    key: 'proposalIntro',
    label: 'Proposal Introduction',
    instruction: 'Write a professional proposal introduction paragraph (3-4 sentences). This is the opening section of a formal proposal document. Reference the recommended service. Tone: confident, respectful, solution-oriented. No subject line.',
    requiresSubject: false,
  },
  {
    key: 'phoneScript',
    label: 'Phone Call Script',
    instruction: 'Write a structured outbound cold-call script with these clearly labeled sections:\n- Opening / Introduction (10-15 seconds, states who you are and why you are calling)\n- Permission-based hook referencing one specific detected gap or positive signal about the business (use only real data provided, never fabricate)\n- 2-3 short discovery questions to qualify the prospect and uncover pain points\n- Brief value proposition tied to the recommended service\n- Objection-handling notes for the 2 most likely objections with a one-line response to each\n- Clear call to action / next step\nTone: confident, conversational, respectful of the business owner\'s time — written the way a real person would speak on the phone, not like an email.',
    requiresSubject: false,
  },
];

async function getLeadContext(leadId: string, workspaceId: string): Promise<LeadContext | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId: workspaceId },
    include: {
      enrichment: true,
      opportunity: true,
    },
  });
  if (!lead) return null;

  return {
    id: lead.id,
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    website: lead.website,
    phone: lead.phone,
    email: lead.email,
    description: null,
    enrichment: lead.enrichment
      ? {
          emails: lead.enrichment.emails,
          linkedinUrl: lead.enrichment.linkedinUrl,
          facebookUrl: lead.enrichment.facebookUrl,
          instagramUrl: lead.enrichment.instagramUrl,
          tiktokUrl: lead.enrichment.tiktokUrl,
          youtubeUrl: lead.enrichment.youtubeUrl,
        }
      : null,
    opportunity: lead.opportunity
      ? {
          detectedGaps: lead.opportunity.detectedGaps,
          recommendedService: lead.opportunity.recommendedService,
          recommendedServiceDetails: lead.opportunity.recommendedServiceDetails,
          conversionProbability: lead.opportunity.conversionProbability,
        }
      : null,
  };
}

function getLeadContextText(ctx: LeadContext): string {
  const parts: string[] = [];
  parts.push(`Business name: ${ctx.businessName}`);
  parts.push(`Category/Industry: ${ctx.category || 'Not specified'}`);
  parts.push(`City: ${ctx.city || 'Not specified'}`);
  if (ctx.rating != null) parts.push(`Rating: ${ctx.rating}/5`);
  if (ctx.reviewCount != null) parts.push(`Review count: ${ctx.reviewCount}`);
  if (ctx.website) parts.push(`Website: ${ctx.website}`);
  if (ctx.phone) parts.push(`Phone: ${ctx.phone}`);
  if (ctx.email) parts.push(`Email: ${ctx.email}`);
  if (ctx.enrichment?.emails && ctx.enrichment.emails.length > 0) {
    parts.push(`Found emails: ${ctx.enrichment.emails.join(', ')}`);
  }
  const socials: string[] = [];
  if (ctx.enrichment?.linkedinUrl) socials.push('LinkedIn');
  if (ctx.enrichment?.facebookUrl) socials.push('Facebook');
  if (ctx.enrichment?.instagramUrl) socials.push('Instagram');
  if (ctx.enrichment?.tiktokUrl) socials.push('TikTok');
  if (ctx.enrichment?.youtubeUrl) socials.push('YouTube');
  if (socials.length > 0) parts.push(`Social profiles: ${socials.join(', ')}`);
  return parts.join('\n');
}

function getDetectedGapsText(ctx: LeadContext): string {
  const gaps = ctx.opportunity?.detectedGaps;
  if (!gaps || !Array.isArray(gaps) || gaps.length === 0) return 'No specific gaps detected.';
  const detected = gaps.filter((g: any) => g.detected);
  if (detected.length === 0) return 'No specific issues were found with this business.';
  return detected.map((g: any) => `- ${g.label}: ${g.detail}`).join('\n');
}

function getPositiveSignals(ctx: LeadContext): string {
  const signals: string[] = [];
  if (ctx.rating != null && ctx.rating >= 4.0) signals.push(`Strong rating of ${ctx.rating}/5`);
  if ((ctx.reviewCount ?? 0) >= 20) signals.push(`${ctx.reviewCount} reviews showing solid customer engagement`);
  if (ctx.phone) signals.push('Phone number available for contact');
  if (ctx.website) signals.push('Existing website presence');
  if (ctx.email) signals.push('Email listed');
  if (ctx.enrichment?.emails && ctx.enrichment.emails.length > 0) signals.push('Email contact(s) found');
  if (ctx.enrichment?.linkedinUrl) signals.push('LinkedIn profile found');
  if (ctx.enrichment?.facebookUrl) signals.push('Facebook profile found');
  if (ctx.enrichment?.instagramUrl) signals.push('Instagram profile found');
  if (ctx.enrichment?.tiktokUrl) signals.push('TikTok profile found');
  if (ctx.enrichment?.youtubeUrl) signals.push('YouTube profile found');
  if (signals.length === 0) signals.push('Business is listed and operational on Google Maps');
  return signals.join('; ');
}

function buildPromptForChannel(spec: ChannelSpec, ctx: LeadContext): string {
  const parts: string[] = [];
  parts.push('--- LEAD DATA ---');
  parts.push(getLeadContextText(ctx));
  parts.push('');
  parts.push('--- DETECTED GAPS ---');
  parts.push(getDetectedGapsText(ctx));
  parts.push('');
  parts.push('--- POSITIVE SIGNALS ---');
  parts.push(getPositiveSignals(ctx));
  parts.push('');
  if (ctx.opportunity?.recommendedService) {
    parts.push('--- RECOMMENDED SERVICE ---');
    parts.push(ctx.opportunity.recommendedService);
    parts.push('');
  }
  parts.push('--- INSTRUCTION ---');
  parts.push(spec.instruction);
  parts.push('');
  parts.push('Write the message now. Use the exact business name and facts from the data above. Do not use any placeholder text or brackets. Reference only issues that are listed as detected gaps. If no gaps are detected, write a positive growth-oriented message.');
  return parts.join('\n');
}

function buildSystemPrompt(): string {
  return 'You are an expert B2B copywriter specializing in local business outreach. Your task is to write personalized outreach messages for digital marketing services. Follow the channel-specific instructions exactly. Do NOT use placeholders like "[Business Name]" — the business name and all facts are provided in the context. Write natural, human-sounding copy that references only the real issues and facts provided. Never fabricate issues that are not listed as detected gaps. If no gaps are detected, write positive, growth-focused messages instead.';
}

async function callAiForMessage(
  prompt: string,
  systemPrompt: string,
  aiConfig: AiOutreachConfig,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const baseUrl = aiConfig.apiBase || 'https://api.openai.com/v1';
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.75,
        max_tokens: 800,
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      return { ok: false, error: `API error ${resp.status}: ${errBody.slice(0, 200)}` };
    }
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return { ok: false, error: 'Empty response from AI' };
    return { ok: true, text: text.trim() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

export async function generateAndPersistMessage(
  leadId: string,
  workspaceId: string,
  channel: 'email' | 'linkedin' | 'whatsapp' | 'proposalIntro' | 'phoneScript',
  aiConfig: AiOutreachConfig,
): Promise<{ ok: boolean; error?: string; editedBlocked?: boolean }> {
  const ctx = await getLeadContext(leadId, workspaceId);
  if (!ctx) return { ok: false, error: 'Lead not found' };

  const existing = await prisma.outreachMessage.findUnique({
    where: { leadId_channel: { leadId, channel } },
  });

  if (existing?.editedByHuman) {
    return { ok: false, editedBlocked: true, error: 'Message was edited by human — not overwriting without confirmation' };
  }

  const spec = OUTREACH_CHANNELS.find(c => c.key === channel);
  if (!spec) return { ok: false, error: `Unknown channel: ${channel}` };

  const prompt = buildPromptForChannel(spec, ctx);
  const systemPrompt = buildSystemPrompt();
  const result = await callAiForMessage(prompt, systemPrompt, aiConfig);

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  let body = result.text;
  let subject: string | undefined;

  if (spec.requiresSubject) {
    const subjectMatch = body.match(/^Subject:\s*(.+?)(?:\n|$)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      body = body.replace(/^Subject:\s*.+?(?:\n|$)/, '').trim();
    }
  }

  const modelLabel = `${aiConfig.provider}/${aiConfig.model}`;

  await prisma.outreachMessage.upsert({
    where: { leadId_channel: { leadId, channel } },
    create: {
      leadId,
      channel,
      subject,
      body,
      editedByHuman: false,
      modelGeneratedBy: modelLabel,
      generatedAt: new Date(),
    },
    update: {
      subject,
      body,
      editedByHuman: false,
      modelGeneratedBy: modelLabel,
      generatedAt: new Date(),
    },
  });

  return { ok: true };
}

export async function generateAllMessagesForLead(
  leadId: string,
  workspaceId: string,
  aiConfig: AiOutreachConfig,
): Promise<{
  ok: boolean;
  results: Record<string, { ok: boolean; error?: string; editedBlocked?: boolean }>;
}> {
  const results: Record<string, { ok: boolean; error?: string; editedBlocked?: boolean }> = {};

  for (const spec of OUTREACH_CHANNELS) {
    const result = await generateAndPersistMessage(leadId, workspaceId, spec.key, aiConfig);
    results[spec.key] = result;
  }

  const totalOk = Object.values(results).filter(r => r.ok).length;
  return { ok: totalOk > 0, results };
}

export async function batchGenerateMessages(
  leadIds: string[],
  workspaceId: string,
  aiConfig: AiOutreachConfig,
): Promise<{
  results: Record<string, { ok: boolean; results?: Record<string, any>; error?: string }>;
}> {
  const results: Record<string, { ok: boolean; results?: Record<string, any>; error?: string }> = {};

  for (const leadId of leadIds) {
    try {
      const r = await generateAllMessagesForLead(leadId, workspaceId, aiConfig);
      results[leadId] = { ok: r.ok, results: r.results };
    } catch (err) {
      results[leadId] = { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  return { results };
}
