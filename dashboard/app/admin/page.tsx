import { requireRole } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { Users, Cpu, Activity, TrendingUp } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage() {
  await requireRole(UserRole.ADMIN);

  const now = new Date();
  const startOfDay   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek  = new Date(now); startOfWeek.setDate(now.getDate() - 7);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    totalLeads,
    sessionsToday,
    sessionsWeek,
    sessionsMonth,
    activeWorkers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.business.count(),
    prisma.scrapingSession.count({ where: { startedAt: { gte: startOfDay } } }),
    prisma.scrapingSession.count({ where: { startedAt: { gte: startOfWeek } } }),
    prisma.scrapingSession.count({ where: { startedAt: { gte: startOfMonth } } }),
    prisma.workerSession.count({
      where: { status: 'online', lastSeenAt: { gte: new Date(Date.now() - 90_000) } }
    }),
  ]);

  const stats = [
    { label: 'Total Users',       value: totalUsers,    icon: Users,     color: '#4ecdc4' },
    { label: 'Total Leads',       value: totalLeads,    icon: TrendingUp, color: '#e8806a' },
    { label: 'Active Workers',    value: activeWorkers, icon: Cpu,       color: '#a78bfa' },
    { label: 'Sessions Today',    value: sessionsToday, icon: Activity,  color: '#34d399' },
    { label: 'Sessions This Week',value: sessionsWeek,  icon: Activity,  color: '#34d399' },
    { label: 'Sessions This Month',value: sessionsMonth,icon: Activity,  color: '#34d399' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Usage Overview</h1>
      <p className="text-sm mb-8" style={{ color: '#6a9090' }}>
        Live platform metrics — refreshes on each page load.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-6 border" style={{ background: '#0a1414', borderColor: '#1e3232' }}>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm" style={{ color: '#6a9090' }}>{label}</p>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: '#162424', color }}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
