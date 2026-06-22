'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ChevronLeft, ChevronRight, UserCheck, UserX, Trash2, Eye } from 'lucide-react';

const ROLES = ['', 'USER', 'ADMIN', 'SUPER_ADMIN'];

type User = {
  id: string; name: string | null; email: string | null;
  role: string; suspended: boolean; createdAt: string;
  lastActiveAt: string | null; _count: { businesses: number };
};

export default function AdminUsersPage() {
  const [users, setUsers]     = useState<User[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [roleFilter, setRole] = useState('');
  const [loading, setLoading] = useState(true);

  const perPage = 25;
  const pages   = Math.ceil(total / perPage);

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page), per: String(perPage),
      ...(search ? { search } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
    });
    const res = await fetch(`/api/admin/users?${params}`);
    const data = await res.json();
    setUsers(data.users ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  };

  useEffect(() => { load(); }, [page, roleFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleSuspend = async (id: string, suspend: boolean) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: suspend }),
    });
    load();
  };

  const handleDelete = async (id: string, email: string | null) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    load();
  };

  const roleColor: Record<string, string> = {
    USER: '#6a9090', ADMIN: '#4ecdc4', SUPER_ADMIN: '#e8806a',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">User Management</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-60">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#6a9090' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by email…"
              className="w-full pl-9 pr-4 py-2 rounded-lg text-sm outline-none text-white"
              style={{ background: '#0a1414', border: '1px solid #1e3232' }}
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ background: '#1e3232' }}>Search</button>
        </form>
        <select value={roleFilter} onChange={e => { setRole(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-lg text-sm outline-none text-white"
          style={{ background: '#0a1414', border: '1px solid #1e3232' }}>
          {ROLES.map(r => <option key={r} value={r}>{r || 'All Roles'}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#1e3232' }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#0a1414', borderBottom: '1px solid #1e3232' }}>
            <tr>
              {['Name / Email','Role','Status','Created','Last Active','Leads','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: '#6a9090' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#6a9090' }}>Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#6a9090' }}>No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} style={{ borderBottom: '1px solid #1e3232', background: '#080f0f' }}>
                <td className="px-4 py-3">
                  <p className="text-white font-medium">{u.name ?? '—'}</p>
                  <p className="text-xs" style={{ color: '#6a9090' }}>{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{ background: '#162424', color: roleColor[u.role] ?? '#6a9090' }}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs" style={{
                    background: u.suspended ? '#2a0a0a' : '#0a2a1a',
                    color: u.suspended ? '#f87171' : '#34d399'
                  }}>
                    {u.suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#6a9090' }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: '#6a9090' }}>
                  {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-white">{u._count.businesses}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/users/${u.id}`} title="View">
                      <Eye className="w-4 h-4" style={{ color: '#4ecdc4' }} />
                    </Link>
                    <button onClick={() => handleSuspend(u.id, !u.suspended)} title={u.suspended ? 'Reinstate' : 'Suspend'}>
                      {u.suspended
                        ? <UserCheck className="w-4 h-4" style={{ color: '#34d399' }} />
                        : <UserX className="w-4 h-4" style={{ color: '#f59e0b' }} />}
                    </button>
                    <button onClick={() => handleDelete(u.id, u.email)} title="Delete">
                      <Trash2 className="w-4 h-4" style={{ color: '#f87171' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <p className="text-sm" style={{ color: '#6a9090' }}>
          {total} user{total !== 1 ? 's' : ''}
        </p>
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
