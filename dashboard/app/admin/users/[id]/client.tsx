'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'];

type Session = { id: string; name: string | null; email: string | null; role: string; suspended: boolean; createdAt: string; lastActiveAt: string | null; _count: { businesses: number; scrapingSessions: number; sentEmails: number }; scrapingSessions: any[] };

export default function UserDetailClient({ user: initialUser, actorRole, isSuperAdmin }: {
  user: Session; actorRole: string; isSuperAdmin: boolean;
}) {
  const [user, setUser]     = useState(initialUser);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const { update } = useSession();

  const patch = async (data: object) => {
    setSaving(true);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      setUser(u => ({ ...u, ...updated }));
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${user.email} and all their data?`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
    router.push('/admin/users');
  };

  const handleImpersonate = async () => {
    const res = await fetch(`/api/admin/users/${user.id}/impersonate`, { method: 'POST' });
    if (!res.ok) { alert('Impersonation failed'); return; }
    const { impersonateUserId, impersonatedBy } = await res.json();
    await update({ isImpersonating: true, impersonateUserId, impersonatedBy });
    router.push('/dashboard');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl p-6 border" style={{ background: '#0a1414', borderColor: '#1e3232' }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">{user.name ?? 'No name'}</h1>
            <p style={{ color: '#6a9090' }}>{user.email}</p>
          </div>
          <span className="px-3 py-1 rounded text-sm font-medium" style={{
            background: '#162424',
            color: user.suspended ? '#f87171' : '#34d399'
          }}>
            {user.suspended ? 'Suspended' : 'Active'}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            ['Leads',    user._count.businesses],
            ['Sessions', user._count.scrapingSessions],
            ['Emails',   user._count.sentEmails],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-lg p-4" style={{ background: '#111c1c' }}>
              <p className="text-xs mb-1" style={{ color: '#6a9090' }}>{label}</p>
              <p className="text-2xl font-bold text-white">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl p-6 border" style={{ background: '#0a1414', borderColor: '#1e3232' }}>
        <h2 className="text-lg font-semibold text-white mb-4">Account Controls</h2>
        <div className="flex flex-wrap gap-3">
          {/* Role change */}
          <div className="flex items-center gap-2">
            <label className="text-sm" style={{ color: '#6a9090' }}>Role:</label>
            <select value={user.role}
              onChange={e => patch({ role: e.target.value })}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-sm text-white outline-none"
              style={{ background: '#162424', border: '1px solid #1e3232' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Suspend / Reinstate */}
          <button
            onClick={() => patch({ suspended: !user.suspended })}
            disabled={saving}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80"
            style={{ background: user.suspended ? '#163f2a' : '#3f1616' }}>
            {user.suspended ? 'Reinstate Account' : 'Suspend Account'}
          </button>

          {/* Impersonate (SUPER_ADMIN only) */}
          {isSuperAdmin && (
            <button onClick={handleImpersonate}
              className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80"
              style={{ background: '#2a1e3f' }}>
              Impersonate User
            </button>
          )}

          {/* Delete */}
          <button onClick={handleDelete}
            className="px-4 py-1.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-80 ml-auto"
            style={{ background: '#3f1616' }}>
            Delete Account
          </button>
        </div>
      </div>

      {/* Recent sessions */}
      <div className="rounded-xl p-6 border" style={{ background: '#0a1414', borderColor: '#1e3232' }}>
        <h2 className="text-lg font-semibold text-white mb-4">Recent Scraping Sessions</h2>
        {user.scrapingSessions.length === 0 ? (
          <p className="text-sm" style={{ color: '#6a9090' }}>No sessions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr>
                {['City','Business Type','Leads','Status','Started'].map(h => (
                  <th key={h} className="text-left py-2 px-3 font-medium" style={{ color: '#6a9090' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {user.scrapingSessions.map((s: any) => (
                <tr key={s.id} style={{ borderTop: '1px solid #1e3232' }}>
                  <td className="py-2 px-3 text-white">{s.city}</td>
                  <td className="py-2 px-3" style={{ color: '#6a9090' }}>{s.businessType}</td>
                  <td className="py-2 px-3 text-white">{s.leadsCollected}</td>
                  <td className="py-2 px-3">
                    <span style={{ color: s.status === 'running' ? '#34d399' : s.status === 'interrupted' ? '#f59e0b' : '#6a9090' }}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2 px-3" style={{ color: '#6a9090' }}>
                    {new Date(s.startedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
