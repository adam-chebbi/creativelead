'use client';
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Log = { id: string; actorEmail: string; action: string; targetId: string | null; metadata: any; createdAt: string };

const ACTION_COLOR: Record<string, string> = {
  ROLE_CHANGE: '#a78bfa',
  ACCOUNT_SUSPENDED: '#f59e0b',
  ACCOUNT_REINSTATED: '#34d399',
  ACCOUNT_DELETED: '#f87171',
  IMPERSONATION_START: '#e8806a',
  FLAG_ENABLED: '#4ecdc4',
  FLAG_DISABLED: '#6a9090',
};

export default function AdminAuditPage() {
  const [logs, setLogs]   = useState<Log[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage]   = useState(1);
  const [loading, setLoading] = useState(true);

  const perPage = 50;
  const pages   = Math.ceil(total / perPage);

  const load = async () => {
    setLoading(true);
    const res  = await fetch(`/api/admin/audit?page=${page}&per=${perPage}`);
    const data = await res.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Audit Log</h1>
      <p className="text-sm mb-8" style={{ color: '#6a9090' }}>
        Append-only record of all admin actions. Cannot be modified or deleted.
      </p>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#1e3232' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#0a1414', borderBottom: '1px solid #1e3232' }}>
            <tr>
              {['Timestamp','Actor','Action','Target','Details'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: '#6a9090' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#6a9090' }}>Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#6a9090' }}>No audit entries yet.</td></tr>
            ) : logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #1e3232', background: '#080f0f' }}>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: '#6a9090' }}>
                  {new Date(l.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-sm text-white">{l.actorEmail}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-mono font-medium"
                    style={{ background: '#162424', color: ACTION_COLOR[l.action] ?? '#6a9090' }}>
                    {l.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: '#6a9090' }}>
                  {l.targetId ? l.targetId.slice(0, 8) + '…' : '—'}
                </td>
                <td className="px-4 py-3 text-xs font-mono" style={{ color: '#6a9090' }}>
                  {l.metadata ? JSON.stringify(l.metadata) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm" style={{ color: '#6a9090' }}>{total} entries</p>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="p-1.5 rounded disabled:opacity-30" style={{ color: '#6a9090' }}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-white">{page} / {pages || 1}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
            className="p-1.5 rounded disabled:opacity-30" style={{ color: '#6a9090' }}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
