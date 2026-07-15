import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[OPPORTUNITY_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
