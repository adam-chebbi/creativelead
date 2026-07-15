import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { analyzeOpportunity } from '@/utils/opportunity-server';

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  let userId, orgId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    orgId = authContext.orgId;
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const result = await analyzeOpportunity(params.id, orgId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Analysis failed' }, { status: 400 });
    }
    const opportunity = await prisma.leadOpportunity.findUnique({
      where: { leadId: params.id },
    });
    return NextResponse.json({
      ok: true,
      data: opportunity ? {
        gaps: opportunity.detectedGaps,
        service: opportunity.recommendedService,
        details: opportunity.recommendedServiceDetails,
        value: opportunity.estimatedDealValue,
        breakdown: opportunity.dealValueBreakdown,
        probability: opportunity.conversionProbability,
        factors: opportunity.conversionFactors,
        confidence: opportunity.confidenceLevel,
      } : null,
    });
  } catch (error) {
    console.error('[OPPORTUNITY_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
