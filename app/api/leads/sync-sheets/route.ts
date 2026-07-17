import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getSecret } from '@/lib/secrets';

const SHEET_COLUMNS = [
  'Company', 'Website', 'Email', 'Phone', 'LinkedIn', 'Facebook',
  'Instagram', 'TikTok', 'YouTube', 'Industry', 'Country',
  'Score', 'Opportunity', 'Priority', 'Status', 'Next Action', 'Last Updated',
];

function mapLeadToRow(lead: any, enrichment: any, opportunity: any): Record<string, string> {
  const country = lead.country || '';
  let priority = '';
  if (lead.classification === 'Hot') priority = 'High';
  else if (lead.classification === 'Warm') priority = 'Medium';
  else if (lead.classification === 'Cold') priority = 'Low';
  else if (lead.aiScore != null) {
    if (lead.aiScore >= 70) priority = 'High';
    else if (lead.aiScore >= 40) priority = 'Medium';
    else priority = 'Low';
  }

  return {
    Company: lead.businessName || '',
    Website: lead.website || '',
    Email: lead.email || (enrichment?.emails?.[0] || ''),
    Phone: lead.phone || '',
    LinkedIn: enrichment?.linkedinUrl || '',
    Facebook: enrichment?.facebookUrl || '',
    Instagram: enrichment?.instagramUrl || '',
    TikTok: enrichment?.tiktokUrl || '',
    YouTube: enrichment?.youtubeUrl || '',
    Industry: lead.category || '',
    Country: country,
    Score: lead.aiScore != null ? String(Math.round(lead.aiScore)) : '',
    Opportunity: opportunity?.recommendedService || '',
    Priority: priority,
    Status: (lead.pipelineStage || 'new').charAt(0).toUpperCase() + (lead.pipelineStage || 'new').slice(1),
    'Next Action': '',
    'Last Updated': lead.updatedAt ? new Date(lead.updatedAt).toLocaleDateString() : '',
  };
}

export async function POST(req: Request) {
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
    const { leadId, sheetUrl: clientSheetUrl } = body;

    const sheetUrl = clientSheetUrl || await getSecret(`org/${orgId}/google-sheets` as any);
    if (!sheetUrl) {
      return NextResponse.json({ error: 'Google Sheets Web App URL not configured. Go to Settings > Google Sheets Integration.' }, { status: 400 });
    }

    let leads;
    if (leadId) {
      const lead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId: orgId },
        include: { enrichment: true, opportunity: true },
      });
      if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      leads = [lead];
    } else {
      leads = await prisma.lead.findMany({
        where: { organizationId: orgId },
        include: { enrichment: true, opportunity: true },
      });
    }

    const rows = leads.map((l: any) => mapLeadToRow(l, l.enrichment, l.opportunity));

    const response = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ columns: SHEET_COLUMNS, rows }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return NextResponse.json({ error: `Google Sheets API returned ${response.status}: ${text.slice(0, 200)}` }, { status: 502 });
    }

    const result = await response.json();
    return NextResponse.json({ ok: true, synced: rows.length, result });
  } catch (error) {
    console.error('[SYNC_SHEETS]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
