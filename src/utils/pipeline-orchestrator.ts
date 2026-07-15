import { prisma } from '@/lib/prisma';
import { queueWebsiteIntel } from './website-intel-server';
import { queueEnrichment } from './enrichment-server';
import { scoreLeadById } from './score-lead-server';
import { analyzeOpportunity } from './opportunity-server';

const MAX_CONCURRENCY = 5;
const BATCH_DELAY_MS = 500;

export async function runFullPipeline(
  leadId: string,
  orgId: string,
): Promise<void> {
  await prisma.backgroundJob.create({
    data: { leadId, jobType: 'website-intelligence', status: 'queued' },
  });
  await prisma.backgroundJob.create({
    data: { leadId, jobType: 'enrichment', status: 'queued' },
  });

  try {
    await queueWebsiteIntel(leadId, orgId);
    await prisma.backgroundJob.updateMany({
      where: { leadId, jobType: 'website-intelligence' },
      data: { status: 'done', finishedAt: new Date() },
    });
  } catch (err) {
    await prisma.backgroundJob.updateMany({
      where: { leadId, jobType: 'website-intelligence' },
      data: { status: 'failed', errorMessage: err instanceof Error ? err.message : 'Unknown error', finishedAt: new Date() },
    });
  }

  try {
    await queueEnrichment(leadId, orgId);
    await prisma.backgroundJob.updateMany({
      where: { leadId, jobType: 'enrichment' },
      data: { status: 'done', finishedAt: new Date() },
    });
  } catch (err) {
    await prisma.backgroundJob.updateMany({
      where: { leadId, jobType: 'enrichment' },
      data: { status: 'failed', errorMessage: err instanceof Error ? err.message : 'Unknown error', finishedAt: new Date() },
    });
  }

  try {
    await scoreLeadById(leadId, orgId);
  } catch (err) {
    console.error(`[pipeline] scoring failed for ${leadId}:`, err);
  }

  try {
    await analyzeOpportunity(leadId, orgId);
  } catch (err) {
    console.error(`[pipeline] opportunity analysis failed for ${leadId}:`, err);
  }
}

export async function runBulkPipeline(
  leadIds: string[],
  orgId: string,
): Promise<{ total: number; succeeded: number; failed: number; errors: { leadId: string; error: string }[] }> {
  const errors: { leadId: string; error: string }[] = [];
  let succeeded = 0;

  const chunks: string[][] = [];
  for (let i = 0; i < leadIds.length; i += MAX_CONCURRENCY) {
    chunks.push(leadIds.slice(i, i + MAX_CONCURRENCY));
  }

  for (const chunk of chunks) {
    const results = await Promise.allSettled(
      chunk.map(async (leadId) => {
        await runFullPipeline(leadId, orgId);
      }),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const leadId = chunk[i];
      if (result.status === 'fulfilled') {
        succeeded++;
      } else {
        const errorMsg = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push({ leadId, error: errorMsg });
      }
    }

    if (chunks.length > 1) {
      await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return { total: leadIds.length, succeeded, failed: errors.length, errors };
}

export async function recalculateAll(
  orgId: string,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const leads = await prisma.lead.findMany({
    where: { organizationId: orgId },
    select: { id: true },
  });

  const leadIds = leads.map(l => l.id);
  const result = await runBulkPipeline(leadIds, orgId);

  await prisma.lead.updateMany({
    where: { organizationId: orgId },
    data: { aiScoreLastComputed: null },
  });

  return result;
}
