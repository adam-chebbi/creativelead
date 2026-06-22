'use client';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSettings, updateSettings, regenerateToken, createJob, deleteJob, getWorkerToken, deleteAccount } from '@/lib/api';
import { signOut } from 'next-auth/react';
import { Check, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { data: settings, refetch } = useQuery({ queryKey: ['settings'], queryFn: getSettings });
  const [form, setForm]   = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [token, setToken]   = useState('');
  const [regenWarning, setRegenWarning] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [jobCity, setJobCity]   = useState('');
  const [jobType, setJobType]   = useState('');
  const [jobMax, setJobMax]     = useState(200);
  const [jobs, setJobs]         = useState<any[]>([]);

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await updateSettings(form);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    refetch();
  };

  const handleShowToken = async () => {
    const res = await getWorkerToken();
    setToken(res.workerToken);
    setShowToken(true);
  };

  const handleRegen = async () => {
    const res = await regenerateToken();
    setToken(res.workerToken);
    setRegenWarning(false);
    setShowToken(true);
  };

  const handleAddJob = async () => {
    if (!jobCity || !jobType) return;
    const res = await createJob({ city: jobCity, businessType: jobType, maxResults: jobMax, scrapeReviews: true });
    setJobs(prev => [...prev, res.job]);
    setJobCity(''); setJobType(''); setJobMax(200);
  };

  const handleDeleteJob = async (id: string) => {
    await deleteJob(id);
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      await signOut({ callbackUrl: '/' });
    } catch (err) {
      setDeleting(false);
      setDeleteWarning(false);
      alert('Failed to delete account. Please try again.');
    }
  };

  const field = (key: string, label: React.ReactNode, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs text-[#6a9090] mb-1">{label}</label>
      <input type={type} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-lg text-sm text-white outline-none focus:ring-1 focus:ring-[#4ecdc4]"
        style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
    </div>
  );

  const toggle = (key: string, label: string) => (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-white">{label}</span>
      <div onClick={() => setForm(f => ({ ...f, [key]: !f[key] }))}
        className={`w-10 h-6 rounded-full transition-colors relative ${form[key] ? 'bg-[#4ecdc4]' : 'bg-[#1e3232]'}`}>
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${form[key] ? 'translate-x-5' : 'translate-x-1'}`} />
      </div>
    </label>
  );

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

      {/* API Keys */}
      <div className="p-6 rounded-xl border mb-6" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">API Keys</h2>
        <div className="space-y-4">
          {field('resendApiKey', <span className="flex items-center gap-1">Resend API Key {settings?.hasResendKey && <span className="text-green-400 flex items-center gap-1">(set <Check className="w-3 h-3" />)</span>}</span>, 'password', 're_...')}
          {field('resendFromEmail', 'From Email', 'email', 'outreach@yourdomain.com')}
          {field('groqApiKey', <span className="flex items-center gap-1">Groq API Key {settings?.hasGroqKey && <span className="text-green-400 flex items-center gap-1">(set <Check className="w-3 h-3" />)</span>}</span>, 'password', 'gsk_...')}
        </div>
      </div>

      {/* Email Template */}
      <div className="p-6 rounded-xl border mb-6" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Email Template</h2>
        <textarea value={form.emailTemplate ?? ''} onChange={e => setForm(f => ({ ...f, emailTemplate: e.target.value }))}
          rows={6} placeholder="Hi {name}, I came across your business..."
          className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none resize-none"
          style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
      </div>

      {/* Follow-up Schedule */}
      <div className="p-6 rounded-xl border mb-6" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Follow-up Schedule</h2>
        <div className="space-y-4">
          {toggle('followupStep3Enabled',  'Enable follow-up #1')}
          {toggle('followupStep7Enabled',  'Enable follow-up #2')}
          {toggle('followupStep14Enabled', 'Enable follow-up #3')}
          <div className="grid grid-cols-3 gap-3">
            {[['followupStep3Days','Day #1'],['followupStep7Days','Day #2'],['followupStep14Days','Day #3']].map(([k,l]) => (
              <div key={k}>
                <label className="block text-xs text-[#6a9090] mb-1">{l}</label>
                <input type="number" value={form[k] ?? ''} onChange={e => setForm(f => ({ ...f, [k]: parseInt(e.target.value) }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
                  style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scraping Settings */}
      <div className="p-6 rounded-xl border mb-6" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Scraping Settings</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[#6a9090] mb-1">Scroll Delay Min (ms)</label>
            <input type="number" value={form.scrollDelayMin ?? 800} onChange={e => setForm(f => ({ ...f, scrollDelayMin: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
          </div>
          <div>
            <label className="block text-xs text-[#6a9090] mb-1">Scroll Delay Max (ms)</label>
            <input type="number" value={form.scrollDelayMax ?? 1800} onChange={e => setForm(f => ({ ...f, scrollDelayMax: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg text-sm text-white outline-none"
              style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
          </div>
        </div>
      </div>

      {/* Scraping Jobs */}
      <div className="p-6 rounded-xl border mb-6" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Scraping Jobs Queue</h2>
        <div className="flex gap-3 mb-4">
          <input placeholder="City" value={jobCity} onChange={e => setJobCity(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
          <input placeholder="Business type" value={jobType} onChange={e => setJobType(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
          <input type="number" placeholder="Max" value={jobMax} onChange={e => setJobMax(parseInt(e.target.value))}
            className="w-20 px-3 py-2 rounded-lg text-sm text-white outline-none" style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
          <button onClick={handleAddJob} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#4ecdc4', color: '#080f0f' }}>Add</button>
        </div>
        {jobs.length > 0 && (
          <div className="space-y-2">
            {jobs.map(j => (
              <div key={j.id} className="flex items-center justify-between px-4 py-2 rounded-lg" style={{ background: '#111c1c' }}>
                <span className="text-white text-sm">{j.businessType} in {j.city} ({j.maxResults} max)</span>
                <button onClick={() => handleDeleteJob(j.id)} className="text-xs text-red-400 hover:underline">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 flex items-center justify-center gap-2 rounded-lg font-semibold text-white mb-8 disabled:opacity-50 transition-opacity hover:opacity-90"
        style={{ background: '#e8806a' }}>
        {saving ? 'Saving...' : saved ? <><Check className="w-5 h-5" /> Saved!</> : 'Save Settings'}
      </button>

      {/* Worker Token */}
      <div className="p-6 rounded-xl border mb-8" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-2">Worker Token</h2>
        <p className="text-xs text-[#6a9090] mb-4">This token authenticates your desktop worker. Keep it secret.</p>
        {showToken ? (
          <div>
            <div className="px-4 py-3 rounded-lg font-mono text-xs text-[#4ecdc4] break-all mb-3" style={{ background: '#111c1c' }}>{token}</div>
            <button onClick={() => { navigator.clipboard.writeText(token); }} className="text-xs text-[#4ecdc4] hover:underline">Copy to clipboard</button>
          </div>
        ) : (
          <button onClick={handleShowToken} className="px-4 py-2 rounded-lg text-sm border border-[#4ecdc4]/30 text-[#4ecdc4] hover:border-[#4ecdc4]/60">Show Token</button>
        )}
        <div className="mt-4 pt-4 border-t" style={{ borderColor: '#1e3232' }}>
          <p className="text-xs text-[#6a9090] mb-3 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Regenerating invalidates all connected workers immediately.</p>
          <button onClick={() => setRegenWarning(true)} className="px-4 py-2 rounded-lg text-sm border border-red-400/30 text-red-400 hover:border-red-400/60">Regenerate Token</button>
        </div>
      </div>

      {/* Account Deletion */}
      <div className="p-6 rounded-xl border border-red-500/20 mb-8" style={{ background: '#0d1a1a' }}>
        <h2 className="text-red-400 font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Danger Zone</h2>
        <p className="text-xs text-[#6a9090] mb-4">Deleting your account is permanent. All your data, leads, settings, and connected integrations will be immediately and irreversibly deleted. Active workers will be disconnected.</p>
        <button onClick={() => setDeleteWarning(true)} className="px-4 py-2 rounded-lg text-sm border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors">
          Delete Account
        </button>
      </div>

    {/* Regen confirm */}
      {regenWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="p-8 rounded-2xl border max-w-sm w-full mx-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h3 className="text-white font-bold text-lg mb-3">Regenerate Token?</h3>
            <p className="text-[#6a9090] text-sm mb-6">All connected workers will be disconnected immediately. You will need to paste the new token into each worker.</p>
            <div className="flex gap-3">
               <button onClick={handleRegen} className="flex-1 py-3 rounded-lg font-semibold text-white" style={{ background: '#e8806a' }}>Regenerate</button>
               <button onClick={() => setRegenWarning(false)} className="flex-1 py-3 rounded-lg text-[#6a9090] border border-[#1e3232]">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account confirm */}
      {deleteWarning && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="p-8 rounded-2xl border border-red-500/20 max-w-sm w-full mx-4" style={{ background: '#0d1a1a' }}>
            <h3 className="text-red-400 font-bold text-lg mb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Delete Account?</h3>
            <p className="text-[#6a9090] text-sm mb-6">This action cannot be undone. All your leads and settings will be permanently destroyed.</p>
            <div className="flex gap-3">
              <button onClick={handleDeleteAccount} disabled={deleting} className="flex-1 py-3 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => setDeleteWarning(false)} disabled={deleting} className="flex-1 py-3 rounded-lg text-[#6a9090] border border-[#1e3232] hover:text-white transition-colors disabled:opacity-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
