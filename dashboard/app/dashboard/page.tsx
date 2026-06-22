'use client';
import { useEffect, useState, useRef } from 'react';
import { useSession, getSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { getStats } from '@/lib/api';
import { formatDateTime, timeAgo, stageColor } from '@/lib/utils';
import { Laptop, Check } from 'lucide-react';
import type { DashboardStats, Lead } from '@/lib/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
      <p className="text-3xl font-bold mb-1" style={{ color }}>{value.toLocaleString()}</p>
      <p className="text-sm text-[#6a9090]">{label}</p>
    </div>
  );
}

export default function OverviewPage() {
  const { data: session } = useSession();
  const { data: stats, refetch } = useQuery<DashboardStats>({
    queryKey: ['stats'],
    queryFn: getStats,
    refetchInterval: 30_000,
  });

  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [liveLeads, setLiveLeads] = useState<Lead[]>([]);
  const [activity, setActivity] = useState<{ time: string; msg: string }[]>([]);
  const [newRowIds, setNewRowIds] = useState<Set<string>>(new Set());
  const userId = (session?.user as any)?.id;

  useEffect(() => {
    if (!userId) return;
    
    let mounted = true;
    let eventSource: EventSource | null = null;

    const connectStream = async () => {
      const s = await getSession();
      if (!s?.accessToken || !mounted) return;
      
      eventSource = new EventSource(`${API_URL}/api/dashboard/stream?token=${encodeURIComponent(s.accessToken as string)}`);
      
      eventSource.onopen = () => { if (mounted) setRealtimeConnected(true); };
      
      eventSource.addEventListener('leads:new', (e) => {
        if (!mounted) return;
        try {
          const p = JSON.parse(e.data);
          setActivity(prev => [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: `${p.count} new lead(s) collected` }, ...prev.slice(0, 49)]);
          setNewRowIds(ids => { const s = new Set(ids); p.leads.forEach((l: any) => s.add(l.id)); return s; });
          setTimeout(() => setNewRowIds(new Set()), 2500);
          refetch();
        } catch (err) {}
      });

      eventSource.addEventListener('session:started', (e) => {
        if (!mounted) return;
        try {
          const p = JSON.parse(e.data);
          setActivity(prev => [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: `Scraping started — ${p.businessType} in ${p.city}` }, ...prev.slice(0, 49)]);
        } catch (err) {}
      });

      eventSource.addEventListener('session:ended', (e) => {
        if (!mounted) return;
        try {
          const p = JSON.parse(e.data);
          setActivity(prev => [{ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), msg: `Session ended — ${p.leadsCollected} leads collected` }, ...prev.slice(0, 49)]);
          refetch();
        } catch (err) {}
      });

      eventSource.onerror = () => {
        if (mounted) setRealtimeConnected(false);
      };
    };

    connectStream();

    return () => { 
      mounted = false;
      if (eventSource) eventSource.close(); 
      setRealtimeConnected(false); 
    };
  }, [userId, refetch]);

  const recentLeads = [...(liveLeads), ...(stats?.recentLeads ?? [])].slice(0, 10);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-[#6a9090] mt-1">Your outreach at a glance</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="text-[#6a9090]">{realtimeConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Leads"        value={stats?.totalLeads ?? 0}          color="#4ecdc4" />
        <StatCard label="With Email"         value={stats?.leadsWithEmail ?? 0}      color="#e8806a" />
        <StatCard label="Sent This Month"    value={stats?.emailsSentThisMonth ?? 0} color="#27c93f" />
        <StatCard label="Sent Today"         value={stats?.emailsSentToday ?? 0}     color="#fff" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Worker Status */}
        <div className="lg:col-span-1">
          <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h2 className="text-white font-semibold mb-4">Worker Status</h2>
            {stats?.workerOnline ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-sm font-medium">Online</span>
                </div>
                <p className="text-white text-sm">{stats.workerInfo?.machineName}</p>
                <p className="text-[#6a9090] text-xs mt-1">{stats.workerInfo?.platform} · v{stats.workerInfo?.workerVersion}</p>
                <p className="text-[#6a9090] text-xs mt-1">Last ping: {timeAgo(stats.workerInfo?.lastPing ?? '')}</p>
                {stats.activeSession && (
                  <div className="mt-4 p-3 rounded-lg" style={{ background: '#111c1c' }}>
                    <p className="text-xs text-[#4ecdc4] font-medium">Active session</p>
                    <p className="text-white text-sm mt-1">{stats.activeSession.businessType} in {stats.activeSession.city}</p>
                    <p className="text-[#6a9090] text-xs mt-1">{stats.activeSession.leadsCollected} / {stats.activeSession.maxResults} leads</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="mb-3 flex justify-center text-[#4ecdc4]">
                  <Laptop className="w-10 h-10" />
                </div>
                <p className="text-white text-sm font-medium mb-2">No worker connected</p>
                <p className="text-[#6a9090] text-xs mb-4">Download and connect the desktop worker to start collecting leads.</p>
                <a href="/download" className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#e8806a' }}>Download Worker</a>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="mt-4 p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h2 className="text-white font-semibold mb-4">Recent Activity</h2>
            {activity.length === 0 ? (
              <p className="text-[#6a9090] text-sm">No activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((a, i) => (
                  <div key={i} className="flex gap-3 text-xs">
                    <span className="text-[#6a9090] shrink-0">{a.time}</span>
                    <span className="text-[#cde0de]">{a.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Leads */}
        <div className="lg:col-span-2">
          <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h2 className="text-white font-semibold mb-4">Recent Leads</h2>
            {recentLeads.length === 0 ? (
              <p className="text-[#6a9090] text-sm">No leads yet. Connect your worker to start collecting.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#6a9090] text-xs border-b" style={{ borderColor: '#1e3232' }}>
                      <th className="text-left pb-3">Business</th>
                      <th className="text-left pb-3">City</th>
                      <th className="text-left pb-3">Email</th>
                      <th className="text-left pb-3">Stage</th>
                      <th className="text-left pb-3">Added</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#1e3232' }}>
                    {recentLeads.map((lead) => (
                      <tr key={lead.id} className={newRowIds.has(lead.id) ? 'animate-row-highlight' : ''}>
                        <td className="py-3 text-white font-medium truncate max-w-[160px]">{lead.name}</td>
                        <td className="py-3 text-[#6a9090]">{lead.city || '—'}</td>
                        <td className="py-3">
                          {lead.email ? <span className="text-green-400 inline-flex"><Check className="w-4 h-4" /></span> : <span className="text-[#6a9090]">—</span>}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${stageColor(lead.stage)}`}>{lead.stage}</span>
                        </td>
                        <td className="py-3 text-[#6a9090] text-xs">{timeAgo(lead.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
