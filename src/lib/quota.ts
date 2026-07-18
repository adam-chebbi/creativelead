import { prisma } from "@/lib/prisma";

export type QuotaMetric =
  | "leads_ingested"
  | "enrichment_runs"
  | "crm_exports"
  | "outreach_generations"
  | "campaign_sends";

function todayMidnight(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function incrementCounter(workspaceId: string, metric: QuotaMetric, amount = 1): Promise<void> {
  const date = todayMidnight();
  await prisma.quotaCounter.upsert({
    where: { workspaceId_metric_date: { workspaceId, metric, date } },
    update: { count: { increment: amount } },
    create: { workspaceId, metric, date, count: amount },
  });
}

export async function getDailyCounters(workspaceId: string): Promise<Record<QuotaMetric, number>> {
  const date = todayMidnight();
  const rows = await prisma.quotaCounter.findMany({
    where: { workspaceId, date },
  });
  const result: Record<string, number> = {};
  for (const metric of ["leads_ingested", "enrichment_runs", "crm_exports", "outreach_generations", "campaign_sends"] as QuotaMetric[]) {
    result[metric] = 0;
  }
  for (const row of rows) {
    result[row.metric] = row.count;
  }
  return result as Record<QuotaMetric, number>;
}

export async function getCounterHistory(workspaceId: string, days = 30): Promise<{ date: string; metric: string; count: number }[]> {
  const cutoff = new Date();
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  const rows = await prisma.quotaCounter.findMany({
    where: { workspaceId, date: { gte: cutoff } },
    orderBy: { date: "desc" },
  });
  return rows.map(r => ({ date: r.date.toISOString().slice(0, 10), metric: r.metric, count: r.count }));
}
