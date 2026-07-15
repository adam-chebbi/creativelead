import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { recalculateAll, runBulkPipeline } from '@/utils/pipeline-orchestrator';

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
    const { leadIds } = body;

    if (leadIds && Array.isArray(leadIds)) {
      const result = await runBulkPipeline(leadIds, orgId);
      return NextResponse.json(result);
    }

    const result = await recalculateAll(orgId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[PIPELINE_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

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
    const leadId = url.searchParams.get('leadId');

    const where: any = { lead: { organizationId: orgId } };
    if (leadId) where.leadId = leadId;

    const jobs = await prisma.backgroundJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const grouped: Record<string, { jobType: string; status: string; errorMessage?: string | null; startedAt?: Date | null; finishedAt?: Date | null }[]> = {};
    for (const job of jobs) {
      if (!grouped[job.leadId]) grouped[job.leadId] = [];
      grouped[job.leadId].push({
        jobType: job.jobType,
        status: job.status,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
      });
    }

    return NextResponse.json({ jobs: grouped });
  } catch (error) {
    console.error('[PIPELINE_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
