'use client';
import { useEffect, useState } from 'react';
import { Toggle } from 'lucide-react';

type Flag = { id: string; key: string; enabled: boolean; description: string | null; updatedAt: string };

export default function AdminFlagsPage() {
  const [flags, setFlags]     = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey]   = useState('');
  const [saving, setSaving]   = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const res  = await fetch('/api/admin/flags');
    const data = await res.json();
    setFlags(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = async (flag: Flag) => {
    setSaving(flag.id);
    await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: flag.key, enabled: !flag.enabled, description: flag.description }),
    });
    await load();
    setSaving(null);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;
    await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey.trim(), enabled: false }),
    });
    setNewKey('');
    load();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Feature Flags</h1>
      <p className="text-sm mb-8" style={{ color: '#6a9090' }}>
        Toggle flags instantly — changes take effect without a deployment.
      </p>

      {/* New flag */}
      <form onSubmit={create} className="flex gap-3 mb-6">
        <input value={newKey} onChange={e => setNewKey(e.target.value)}
          placeholder="new_flag_key"
          className="flex-1 px-4 py-2 rounded-lg text-sm text-white outline-none"
          style={{ background: '#0a1414', border: '1px solid #1e3232' }} />
        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: '#1e3232' }}>
          Add Flag
        </button>
      </form>

      {/* Flags list */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm" style={{ color: '#6a9090' }}>Loading…</p>
        ) : flags.length === 0 ? (
          <p className="text-sm" style={{ color: '#6a9090' }}>No feature flags yet. Add one above.</p>
        ) : flags.map(f => (
          <div key={f.id} className="flex items-center justify-between rounded-xl px-5 py-4 border"
            style={{ background: '#0a1414', borderColor: '#1e3232' }}>
            <div>
              <p className="text-sm font-mono font-medium text-white">{f.key}</p>
              {f.description && <p className="text-xs mt-0.5" style={{ color: '#6a9090' }}>{f.description}</p>}
            </div>
            <button
              onClick={() => toggle(f)}
              disabled={saving === f.id}
              className="w-12 h-6 rounded-full transition-colors flex items-center px-1 disabled:opacity-50"
              style={{ background: f.enabled ? '#4ecdc4' : '#1e3232' }}>
              <div className="w-4 h-4 rounded-full bg-white transition-transform"
                style={{ transform: f.enabled ? 'translateX(24px)' : 'translateX(0)' }} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
