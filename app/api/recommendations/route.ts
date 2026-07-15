import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { computeRecommendations } from '@/utils/recommendations-server';

export async function GET(req: Request) {
  let userId, orgId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    orgId = authContext.orgId;
  } catch {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const referenceLeadId = url.searchParams.get('referenceLeadId') || undefined;

    const result = await computeRecommendations(orgId, referenceLeadId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[RECOMMENDATIONS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
