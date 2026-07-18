import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enrichLead } from '@/utils/enrichment-server';
import { incrementCounter } from '@/lib/quota';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let userId, workspaceId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    workspaceId = authContext.workspaceId;
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';

  try {
    const result = await enrichLead(params.id, workspaceId, undefined, undefined, force);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Enrichment failed' }, { status: 400 });
    }
    incrementCounter(workspaceId, 'enrichment_runs').catch(() => {});
    const enrichment = await prisma.leadEnrichment.findUnique({
      where: { leadId: params.id },
    });
    return NextResponse.json({
      ok: true,
      data: enrichment ? {
        business_size: enrichment.businessSize,
        revenue_estimation: enrichment.revenueEstimate,
        industry_classification: enrichment.industryClassification,
        generated_description: enrichment.generatedDescription,
        enrichment_status: enrichment.status,
        enrichment_confidence: enrichment.confidenceLevel,
        emails: enrichment.emails,
        additional_phones: enrichment.additionalPhones,
        linkedin: enrichment.linkedinUrl,
        facebook: enrichment.facebookUrl,
        instagram: enrichment.instagramUrl,
        tiktok: enrichment.tiktokUrl,
        youtube: enrichment.youtubeUrl,
      } : null,
    });
  } catch (error) {
    console.error('[ENRICHMENT_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
