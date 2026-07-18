import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const existing = await prisma.lead.findFirst({ where: { id: params.id, workspaceId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, unknown> = {};

    const fieldMap: Record<string, string> = {
      phone: 'phone', website: 'website', linkedin: 'linkedin',
      facebook: 'facebook', instagram: 'instagram', tiktok: 'tiktok',
      youtube: 'youtube', emails: 'emails', additional_phones: 'additionalPhones',
      ai_score: 'aiScore', classification: 'classification',
      opportunity_score: 'opportunityScore', competition_score: 'competitionScore',
      growth_score: 'growthScore', seo_weakness: 'seoWeakness',
      website_quality: 'websiteQuality', review_reputation: 'reviewReputation',
    };
    for (const [clientKey, dbKey] of Object.entries(fieldMap)) {
      if (body[clientKey] !== undefined) data[dbKey] = body[clientKey];
    }
    if (body._stage) data.pipelineStage = body._stage;
    if (body.website_intelligence) data.websiteIntel = body.website_intelligence;
    if (body.opportunity_gaps) data.detectedGaps = body.opportunity_gaps;

    await prisma.lead.update({ where: { id: params.id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const existing = await prisma.lead.findFirst({ where: { id: params.id, workspaceId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.lead.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    const status = message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
