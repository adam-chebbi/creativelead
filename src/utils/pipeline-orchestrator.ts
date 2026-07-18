import { prisma } from '@/lib/prisma';
import { enqueueJob } from '@/lib/queue';

export async function runFullPipeline(
  leadId: string,
  workspaceId: string,
): Promise<void> {
  await enqueueJob(leadId, 'website-intelligence');
  await enqueueJob(leadId, 'enrichment');
  await enqueueJob(leadId, 'scoring');
  await enqueueJob(leadId, 'opportunity');
}

export async function runBulkPipeline(
  leadIds: string[],
  workspaceId: string,
): Promise<{ total: number; succeeded: number; failed: number; errors: { leadId: string; error: string }[] }> {
  const errors: { leadId: string; error: string }[] = [];
  let succeeded = 0;

  for (const leadId of leadIds) {
    try {
      await runFullPipeline(leadId, workspaceId);
      succeeded++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ leadId, error: errorMsg });
    }
  }

  return { total: leadIds.length, succeeded, failed: errors.length, errors };
}

export async function recalculateAll(
  workspaceId: string,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const leads = await prisma.lead.findMany({
    where: { workspaceId: workspaceId },
    select: { id: true },
  });

  const leadIds = leads.map(l => l.id);
  const result = await runBulkPipeline(leadIds, workspaceId);

  await prisma.lead.updateMany({
    where: { workspaceId: workspaceId },
    data: { aiScoreLastComputed: null },
  });

  return result;
}
