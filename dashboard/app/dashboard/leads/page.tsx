'use client';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeads, getLeadFilters, bulkStageLeads, bulkDeleteLeads, updateLead, deleteLead } from '@/lib/api';
import { stageColor, timeAgo } from '@/lib/utils';
import Link from 'next/link';

const STAGES = ['New','Contacted','Replied','Closed','Unsubscribed'];

export default function LeadsPage() {
  const [page, setPage]         = useState(1);
  const [search, setSearch]     = useState('');
  const [city, setCity]         = useState('');
  const [category, setCategory] = useState('');
  const [stage, setStage]       = useState('');
  const [hasEmail, setHasEmail] = useState('');
  const [sortBy, setSortBy]     = useState('createdAt');
  const [sortDir, setSortDir]   = useState('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState('');

  const params = { page, limit: 50, ...(search && { search }), ...(city && { city }), ...(category && { category }), ...(stage && { stage }), ...(hasEmail && { hasEmail }), sortBy, sortDir };

  const { data, refetch } = useQuery({ queryKey: ['leads', params], queryFn: () => getLeads(params) });
  const { data: filters }  = useQuery({ queryKey: ['lead-filters'], queryFn: getLeadFilters });

  const leads      = data?.data ?? [];
  const pagination = data?.pagination;

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll   = () => setSelected(selected.size === leads.length ? new Set() : new Set(leads.map((l: any) => l.id)));

  const handleBulkStage = async () => {
    if (!bulkStage || selected.size === 0) return;
    await bulkStageLeads([...selected], bulkStage);
    setSelected(new Set()); refetch();
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} leads?`)) return;
    await bulkDeleteLeads([...selected]);
    setSelected(new Set()); refetch();
  };

  const handleStageChange = async (id: string, s: string) => {
    await updateLead(id, { stage: s }); refetch();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return;
    await deleteLead(id); refetch();
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Leads</h1>
          <p className="text-sm text-[#6a9090] mt-1">{pagination?.total ?? 0} total leads</p>
        </div>
        <a href={`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/leads/export/csv`}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-[#4ecdc4]/30 text-[#4ecdc4] hover:border-[#4ecdc4]/60 transition-colors">
          Export CSV
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input placeholder="Search by name..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm text-white outline-none w-48" style={{ background: '#0d1a1a', border: '1px solid #1e3232' }} />
        <select value={city} onChange={e => { setCity(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#0d1a1a', border: '1px solid #1e3232' }}>
          <option value="">All cities</option>
          {filters?.cities?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#0d1a1a', border: '1px solid #1e3232' }}>
          <option value="">All categories</option>
          {filters?.categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={stage} onChange={e => { setStage(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#0d1a1a', border: '1px solid #1e3232' }}>
          <option value="">All stages</option>
          {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={hasEmail} onChange={e => { setHasEmail(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#0d1a1a', border: '1px solid #1e3232' }}>
          <option value="">Any email</option>
          <option value="true">Has email</option>
          <option value="false">No email</option>
        </select>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg" style={{ background: '#162424', border: '1px solid #1e3232' }}>
          <span className="text-sm text-white">{selected.size} selected</span>
          <select value={bulkStage} onChange={e => setBulkStage(e.target.value)}
            className="px-3 py-1.5 rounded text-sm text-white outline-none" style={{ background: '#0d1a1a', border: '1px solid #1e3232' }}>
            <option value="">Move to stage...</option>
            {STAGES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={handleBulkStage} className="px-3 py-1.5 rounded text-sm text-white" style={{ background: '#4ecdc4', color: '#080f0f' }}>Apply</button>
          <button onClick={handleBulkDelete} className="px-3 py-1.5 rounded text-sm text-red-400 border border-red-400/30 hover:border-red-400/60">Delete</button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-[#6a9090] hover:text-white">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-[#6a9090]" style={{ borderColor: '#1e3232', background: '#0a1414' }}>
                <th className="px-4 py-3 text-left w-8">
                  <input type="checkbox" checked={selected.size === leads.length && leads.length > 0} onChange={toggleAll}
                    className="rounded" />
                </th>
                <th className="px-4 py-3 text-left">Business</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">City</th>
                <th className="px-4 py-3 text-left">Rating</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Stage</th>
                <th className="px-4 py-3 text-left">Added</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1e3232' }}>
              {leads.map((lead: any) => (
                <tr key={lead.id} className="hover:bg-[#111c1c] transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" />
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium truncate max-w-[180px]">{lead.name}</p>
                    {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-xs text-[#6a9090] hover:text-[#4ecdc4] truncate block max-w-[180px]">↗ {lead.website}</a>}
                  </td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{lead.category || '—'}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{lead.city || '—'}</td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{lead.rating ? `⭐ ${lead.rating}` : '—'}</td>
                  <td className="px-4 py-3">
                    {lead.email ? <span className="text-green-400 text-xs">✓ {lead.email}</span> : <span className="text-[#6a9090] text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select value={lead.stage} onChange={e => handleStageChange(lead.id, e.target.value)}
                      className={`px-2 py-1 rounded-full text-xs border outline-none cursor-pointer ${stageColor(lead.stage)}`}
                      style={{ background: 'transparent' }}>
                      {STAGES.map(s => <option key={s} value={s} style={{ background: '#0d1a1a', color: '#fff' }}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[#6a9090] text-xs">{timeAgo(lead.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/leads/${lead.id}`} className="text-xs text-[#4ecdc4] hover:underline">View</Link>
                      <button onClick={() => handleDelete(lead.id)} className="text-xs text-red-400 hover:underline">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#1e3232' }}>
            <p className="text-xs text-[#6a9090]">Page {pagination.page} of {pagination.totalPages}</p>
            <div className="flex gap-2">
              <button disabled={!pagination.hasPrev} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded text-xs text-white border border-[#1e3232] disabled:opacity-40 hover:border-[#4ecdc4]/40">← Prev</button>
              <button disabled={!pagination.hasNext} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded text-xs text-white border border-[#1e3232] disabled:opacity-40 hover:border-[#4ecdc4]/40">Next →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
