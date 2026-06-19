'use client';
import { useQuery } from '@tanstack/react-query';
import { getSentEmails, getSessions } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export default function ReportsPage() {
  const { data: sentData }     = useQuery({ queryKey: ['sent-emails'], queryFn: () => getSentEmails({ limit: 50 }) });
  const { data: sessionsData } = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions({ limit: 20 }) });

  const sentEmails     = sentData?.data ?? [];
  const sessions       = sessionsData?.scrapingSessions?.data ?? [];
  const workerSessions = sessionsData?.workerSessions ?? [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-8">Reports</h1>

      {/* Sent Emails */}
      <section className="mb-10">
        <h2 className="text-white font-semibold mb-4">Sent Emails <span className="text-[#6a9090] text-sm">({sentData?.pagination?.total ?? 0})</span></h2>
        <div className="rounded-xl border overflow-hidden" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-[#6a9090]" style={{ borderColor: '#1e3232', background: '#0a1414' }}>
                <th className="px-4 py-3 text-left">Business</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Subject</th>
                <th className="px-4 py-3 text-left">Language</th>
                <th className="px-4 py-3 text-left">Sent</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1e3232' }}>
              {sentEmails.map((e: any) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 text-white truncate max-w-[160px]">{e.businessName}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{e.email}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs truncate max-w-[200px]">{e.subject}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs capitalize">{e.language}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{formatDateTime(e.dateSent)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.status === 'sent' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Scraping Sessions */}
      <section className="mb-10">
        <h2 className="text-white font-semibold mb-4">Scraping Sessions</h2>
        <div className="rounded-xl border overflow-hidden" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-[#6a9090]" style={{ borderColor: '#1e3232', background: '#0a1414' }}>
                <th className="px-4 py-3 text-left">City</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Leads</th>
                <th className="px-4 py-3 text-left">Reviews</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1e3232' }}>
              {sessions.map((s: any) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-white">{s.city}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{s.businessType}</td>
                  <td className="px-4 py-3 text-[#4ecdc4]">{s.leadsCollected}</td>
                  <td className="px-4 py-3 text-[#6a9090]">{s.reviewsCollected}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                      s.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{formatDateTime(s.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Worker Sessions */}
      <section>
        <h2 className="text-white font-semibold mb-4">Connected Workers</h2>
        <div className="rounded-xl border overflow-hidden" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-[#6a9090]" style={{ borderColor: '#1e3232', background: '#0a1414' }}>
                <th className="px-4 py-3 text-left">Machine</th>
                <th className="px-4 py-3 text-left">Platform</th>
                <th className="px-4 py-3 text-left">Version</th>
                <th className="px-4 py-3 text-left">Last Ping</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1e3232' }}>
              {workerSessions.map((ws: any) => (
                <tr key={ws.id}>
                  <td className="px-4 py-3 text-white">{ws.machineName}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs capitalize">{ws.platform}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">v{ws.workerVersion}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{formatDateTime(ws.lastPing)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit ${
                      ws.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {ws.status === 'online' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                      {ws.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
