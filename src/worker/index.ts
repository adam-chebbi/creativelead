import { prisma } from '@/lib/prisma';
import { dequeueJob, completeJob, resetStaleJobs } from '@/lib/queue';
import { analyzeWebsiteServer } from '@/utils/website-intel-server';
import { enrichLead } from '@/utils/enrichment-server';
import { scoreLeadById } from '@/utils/score-lead-server';
import { analyzeOpportunity } from '@/utils/opportunity-server';

const POLL_INTERVAL_MS = 2000;
const STALE_CHECK_INTERVAL_MS = 60_000;
const GRACEFUL_SHUTDOWN_TIMEOUT_MS = 10_000;

let running = true;
let currentJob: string | null = null;

async function processJob(): Promise<void> {
  const job = await dequeueJob();
  if (!job) return;

  currentJob = job.id;

  try {
    const lead = await prisma.lead.findUnique({ where: { id: job.leadId } });
    if (!lead) {
      await completeJob(job.id, 'Lead not found');
      return;
    }
    const workspaceId = lead.workspaceId;

    switch (job.jobType) {
      case 'website-intelligence':
        await analyzeWebsiteServer(job.leadId, workspaceId);
        break;
      case 'enrichment':
        await enrichLead(job.leadId, workspaceId);
        break;
      case 'scoring':
        await scoreLeadById(job.leadId, workspaceId);
        break;
      case 'opportunity':
        await analyzeOpportunity(job.leadId, workspaceId);
        break;
    }

    await completeJob(job.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown worker error';
    console.error(`[worker] job ${job.id} (${job.jobType}, lead ${job.leadId}) failed:`, msg);
    await completeJob(job.id, msg);
  } finally {
    currentJob = null;
  }
}

async function shutdown(): Promise<void> {
  running = false;
  if (currentJob) {
    await new Promise((resolve) => setTimeout(resolve, GRACEFUL_SHUTDOWN_TIMEOUT_MS));
  }
  await prisma.$disconnect();
  process.exit(0);
}

async function main(): Promise<void> {
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('[worker] started, polling every %d ms', POLL_INTERVAL_MS);

  let staleCheckCounter = 0;

  while (running) {
    try {
      if (staleCheckCounter % 30 === 0) {
        const resetCount = await resetStaleJobs();
        if (resetCount > 0) {
          console.log('[worker] reset %d stale running jobs', resetCount);
        }
      }
      staleCheckCounter++;

      await processJob();
    } catch (err) {
      console.error('[worker] unexpected error:', err);
    }

    if (running) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
  }
}

main().catch((err) => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
