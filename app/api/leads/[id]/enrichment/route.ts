import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { enrichLead } from '@/utils/enrichment-server';

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

  const url = new URL(req.url);
  const force = url.searchParams.get('force') === 'true';

  try {
    const result = await enrichLead(params.id, orgId, undefined, undefined, force);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Enrichment failed' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ENRICHMENT_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
