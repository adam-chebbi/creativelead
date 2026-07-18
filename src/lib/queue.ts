import { prisma } from '@/lib/prisma';
import type { BackgroundJob } from '@prisma/client';

type JobType = 'website-intelligence' | 'enrichment' | 'scoring' | 'opportunity';

export async function enqueueJob(
  leadId: string,
  jobType: JobType,
): Promise<BackgroundJob> {
  return prisma.backgroundJob.create({
    data: {
      leadId,
      jobType,
      status: 'queued',
    },
  });
}

export async function dequeueJob(): Promise<BackgroundJob | null> {
  const job = await prisma.backgroundJob.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return null;

  const updated = await prisma.backgroundJob.updateMany({
    where: { id: job.id, status: 'queued' },
    data: { status: 'running', startedAt: new Date() },
  });

  if (updated.count === 0) return null;

  return { ...job, status: 'running', startedAt: new Date() };
}

export async function completeJob(id: string, errorMessage?: string): Promise<void> {
  await prisma.backgroundJob.update({
    where: { id },
    data: {
      status: errorMessage ? 'failed' : 'done',
      errorMessage: errorMessage ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function resetStaleJobs(): Promise<number> {
  const stale = await prisma.backgroundJob.updateMany({
    where: {
      status: 'running',
      startedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) },
    },
    data: { status: 'queued', startedAt: null },
  });
  return stale.count;
}

export async function queueSize(): Promise<number> {
  return prisma.backgroundJob.count({ where: { status: 'queued' } });
}
