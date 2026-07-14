import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { analyzeWebsiteServer } from '@/utils/website-intel-server';

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
  const forceRefresh = url.searchParams.get('force') === 'true';

  try {
    const result = await analyzeWebsiteServer(params.id, orgId, forceRefresh);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Analysis failed' }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[WEBSITE_INTEL_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
