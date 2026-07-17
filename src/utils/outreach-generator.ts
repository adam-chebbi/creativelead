import { Lead, OpportunityGap, OutreachMessages, OutreachMessage } from '../types';
import { callAi, AiRequest } from './api-client';

function getLeadContext(lead: Lead): string {
  const parts: string[] = [];
  parts.push(`Business name: ${lead.business_name}`);
  parts.push(`Category/Industry: ${lead.category || 'Not specified'}`);
  parts.push(`City: ${lead.city || lead.location || 'Not specified'}`);
  if (lead.description) parts.push(`Description: ${lead.description}`);
  if (lead.rating != null) parts.push(`Rating: ${lead.rating}/5`);
  if (lead.review_count != null) parts.push(`Review count: ${lead.review_count}`);
  if (lead.website) parts.push(`Website: ${lead.website}`);
  if (lead.phone_number || lead.phone) parts.push(`Phone: ${lead.phone_number || lead.phone}`);
  return parts.join('\n');
}

function getDetectedGapsText(gaps: OpportunityGap[] | undefined): string {
  if (!gaps || gaps.length === 0) return 'No specific gaps detected.';
  const detected = gaps.filter(g => g.detected);
  if (detected.length === 0) return 'No specific issues were found with this business.';
  return detected.map(g => `- ${g.label}: ${g.detail}`).join('\n');
}

function getPositiveSignals(lead: Lead): string {
  const signals: string[] = [];
  if (lead.rating != null && lead.rating >= 4.0) signals.push(`Strong rating of ${lead.rating}/5`);
  if ((lead.review_count ?? 0) >= 20) signals.push(`${lead.review_count} reviews showing solid customer engagement`);
  if (lead.phone_number || lead.phone) signals.push('Phone number available for contact');
  if (lead.website) signals.push('Existing website presence');
  if (lead.email) signals.push('Email listed');
  const socials: string[] = [];
  if (lead.facebook) socials.push('Facebook');
  if (lead.instagram) socials.push('Instagram');
  if (lead.linkedin) socials.push('LinkedIn');
  if (lead.tiktok) socials.push('TikTok');
  if (lead.youtube) socials.push('YouTube');
  if (socials.length > 0) signals.push(`Active on ${socials.join(', ')}`);
  if (signals.length === 0) signals.push('Business is listed and operational on Google Maps');
  return signals.join('; ');
}

function getSampleReviews(lead: Lead): string {
  if (!lead.reviews || lead.reviews.length === 0) return 'No reviews available.';
  const withText = lead.reviews.filter(r => r.review_text && r.review_text.trim().length > 0);
  if (withText.length === 0) return 'No review text available.';
  return withText.slice(0, 5).map(r => `- "${r.review_text!.slice(0, 150)}" (${r.review_rating ?? 'N/A'}/5)`).join('\n');
}

function buildSystemPrompt(): string {
  return 'You are an expert B2B copywriter specializing in local business outreach. Your task is to write personalized outreach messages for digital marketing services. Follow the channel-specific instructions exactly. Do NOT use placeholders like "[Business Name]" — the business name and all facts are provided in the context. Write natural, human-sounding copy that references only the real issues and facts provided. Never fabricate issues that are not listed as detected gaps. If no gaps are detected, write positive, growth-focused messages instead.';
}

export interface ChannelSpec {
  key: 'email' | 'linkedin' | 'whatsapp' | 'proposalIntro' | 'phoneScript';
  label: string;
  instruction: string;
  requiresSubject: boolean;
}

export const OUTREACH_CHANNELS: ChannelSpec[] = [
  { key: 'email', label: 'Cold Email', instruction: 'Write a professional cold email. Include a subject line on the first line prefixed with "Subject:". The body should be 2-3 paragraphs with a clear call to action. Tone: professional, consultative, helpful.', requiresSubject: true },
  { key: 'linkedin', label: 'LinkedIn Message', instruction: 'Write a short LinkedIn message (max 300 characters). Conversational tone. No subject line. Reference one specific observation. End with a soft call to action.', requiresSubject: false },
  { key: 'whatsapp', label: 'WhatsApp Message', instruction: 'Write a very short WhatsApp message (max 200 characters). Informal, friendly tone. Extremely concise — like texting a business owner. No subject line.', requiresSubject: false },
  { key: 'proposalIntro', label: 'Proposal Introduction', instruction: 'Write a professional proposal introduction paragraph (3-4 sentences). This is the opening section of a formal proposal document. Reference the recommended service. Tone: confident, respectful, solution-oriented. No subject line.', requiresSubject: false },
  {
    key: 'phoneScript',
    label: 'Phone Call Script',
    instruction: 'Write a structured outbound cold-call script with these clearly labeled sections:\n- Opening / Introduction (10-15 seconds, states who you are and why you are calling)\n- Permission-based hook referencing one specific detected gap or positive signal about the business (use only real data provided, never fabricate)\n- 2-3 short discovery questions to qualify the prospect and uncover pain points\n- Brief value proposition tied to the recommended service\n- Objection-handling notes for the 2 most likely objections with a one-line response to each\n- Clear call to action / next step\nTone: confident, conversational, respectful of the business owner\'s time — written the way a real person would speak on the phone, not like an email.',
    requiresSubject: false,
  },
];

function buildPromptForChannel(
  spec: ChannelSpec,
  lead: Lead,
  gaps: OpportunityGap[] | undefined,
  recommendedService: string | undefined,
): string {
  const parts: string[] = [];
  parts.push('--- LEAD DATA ---');
  parts.push(getLeadContext(lead));
  parts.push('');
  parts.push('--- DETECTED GAPS ---');
  parts.push(getDetectedGapsText(gaps));
  parts.push('');
  parts.push('--- POSITIVE SIGNALS ---');
  parts.push(getPositiveSignals(lead));
  parts.push('');
  parts.push('--- SAMPLE REVIEWS ---');
  parts.push(getSampleReviews(lead));
  parts.push('');
  if (recommendedService) {
    parts.push('--- RECOMMENDED SERVICE ---');
    parts.push(recommendedService);
    parts.push('');
  }
  parts.push('--- INSTRUCTION ---');
  parts.push(spec.instruction);
  parts.push('');
  parts.push('Write the message now. Use the exact business name and facts from the data above. Do not use any placeholder text or brackets. Reference only issues that are listed as detected gaps. If no gaps are detected, write a positive growth-oriented message.');

  return parts.join('\n');
}

export async function generateMessage(
  spec: ChannelSpec,
  lead: Lead,
): Promise<{ ok: true; message: OutreachMessage } | { ok: false; error: string }> {
  const gaps = lead.opportunity_gaps;
  const recommendedService = lead.recommended_service;

  const prompt = buildPromptForChannel(spec, lead, gaps, recommendedService);
  const request: AiRequest = {
    prompt,
    systemPrompt: buildSystemPrompt(),
    temperature: 0.75,
    maxTokens: 800,
  };

  const result = await callAi(request);

  if (!result.ok) {
    return { ok: false, error: result.error.message };
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

  return {
    ok: true,
    message: { subject, body, edited: false },
  };
}

export async function generateAllMessages(
  lead: Lead,
): Promise<{ ok: true; messages: OutreachMessages } | { ok: false; errors: Record<string, string> }> {
  const errors: Record<string, string> = {};
  const results: Partial<OutreachMessages> = {};

  for (const spec of OUTREACH_CHANNELS) {
    const result = await generateMessage(spec, lead);
    if (result.ok) {
      (results as Record<string, OutreachMessage>)[spec.key] = result.message;
    } else {
      errors[spec.key] = result.error;
    }
  }

  if (Object.keys(errors).length > 4 && !results.email && !results.linkedin && !results.whatsapp && !results.proposalIntro && !results.phoneScript) {
    return { ok: false, errors };
  }

  const now = new Date().toISOString();
  return {
    ok: true,
    messages: {
      email: results.email || { body: 'Could not generate. Tap retry to try again.', edited: false },
      linkedin: results.linkedin || { body: 'Could not generate. Tap retry to try again.', edited: false },
      whatsapp: results.whatsapp || { body: 'Could not generate. Tap retry to try again.', edited: false },
      proposalIntro: results.proposalIntro || { body: 'Could not generate. Tap retry to try again.', edited: false },
      phoneScript: results.phoneScript || { body: 'Could not generate. Tap retry to try again.', edited: false },
      generatedAt: now,
    },
  };
}