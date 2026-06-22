import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertRole } from '@/lib/admin';
import { UserRole } from '@prisma/client';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = new Date();
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers, totalLeads, sessionsToday, sessionsWeek, sessionsMonth, activeWorkers] =
    await Promise.all([
      prisma.user.count(),
      prisma.business.count(),
      prisma.scrapingSession.count({ where: { startedAt: { gte: startOfDay } } }),
      prisma.scrapingSession.count({ where: { startedAt: { gte: startOfWeek } } }),
      prisma.scrapingSession.count({ where: { startedAt: { gte: startOfMonth } } }),
      prisma.workerSession.count({
        where: { status: 'online', lastSeenAt: { gte: new Date(Date.now() - 90_000) } },
      }),
    ]);

  return NextResponse.json({
    totalUsers, totalLeads, sessionsToday, sessionsWeek, sessionsMonth, activeWorkers,
  });
}
