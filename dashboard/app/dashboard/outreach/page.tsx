'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeads, generateEmail, sendEmail } from '@/lib/api';

const LANGS = [{ value: 'english', label: 'English' }, { value: 'greek', label: 'Greek' }, { value: 'arabic', label: 'Arabic' }];
const SPEEDS = [{ value: 'normal', label: 'Normal (3–6 min/email)' }, { value: 'slow', label: 'Slow (8–15 min/email)' }];

export default function OutreachPage() {
  const [language, setLanguage]   = useState('english');
  const [speed, setSpeed]         = useState('normal');
  const [template, setTemplate]   = useState('');
  const [preview, setPreview]     = useState<{ subject: string; body: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending]     = useState(false);
  const [status, setStatus]       = useState('');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [confirm, setConfirm]     = useState(false);

  const { data } = useQuery({ queryKey: ['leads-outreach'], queryFn: () => getLeads({ hasEmail: 'true', stage: 'New', limit: 100 }) });
  const leads = data?.data ?? [];

  const toggleLead = (id: string) => setSelectedLeads(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const toggleAll  = () => setSelectedLeads(selectedLeads.size === leads.length ? new Set() : new Set(leads.map((l: any) => l.id)));

  const handleGenerate = async () => {
    const lead = leads[Math.floor(Math.random() * leads.length)];
    if (!lead) return;
    setGenerating(true);
    try {
      const res = await generateEmail({ lead: { id: lead.id, name: lead.name, address: lead.address, city: lead.city, category: lead.category }, language, template: template || undefined });
      setPreview(res);
    } catch { setStatus('Generation failed. Check your Groq API key in Settings.'); }
    setGenerating(false);
  };

  const handleLaunch = async () => {
    if (!preview || selectedLeads.size === 0) return;
    setSending(true); setConfirm(false);
    let sent = 0, failed = 0;
    const delay = speed === 'normal' ? [3,6] : [8,15];
    for (const id of selectedLeads) {
      const lead = leads.find((l: any) => l.id === id);
      if (!lead) continue;
      try {
        const gen = await generateEmail({ lead: { id: lead.id, name: lead.name, address: lead.address, city: lead.city, category: lead.category }, language, template: template || undefined });
        await sendEmail({ businessId: lead.id, businessName: lead.name, toEmail: lead.email, subject: gen.subject, body: gen.body, language });
        sent++;
        setStatus(`Sending... ${sent}/${selectedLeads.size}`);
        const wait = (delay[0] + Math.random() * (delay[1] - delay[0])) * 60 * 1000;
        await new Promise(r => setTimeout(r, Math.min(wait, 3000))); // cap at 3s in demo
      } catch { failed++; }
    }
    setSending(false);
    setStatus(`Campaign complete — ${sent} sent, ${failed} failed.`);
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Outreach</h1>
      <p className="text-sm text-[#6a9090] mb-8">Build and launch personalised email campaigns.</p>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Builder */}
        <div className="space-y-4">
          {/* Lead selection */}
          <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-white font-semibold">Select Leads</h2>
              <button onClick={toggleAll} className="text-xs text-[#4ecdc4] hover:underline">
                {selectedLeads.size === leads.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            <p className="text-xs text-[#6a9090] mb-3">{selectedLeads.size} of {leads.length} selected (New leads with email)</p>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {leads.map((lead: any) => (
                <label key={lead.id} className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-[#111c1c]">
                  <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleLead(lead.id)} className="rounded" />
                  <span className="text-white text-sm truncate">{lead.name}</span>
                  <span className="text-[#6a9090] text-xs ml-auto truncate">{lead.city}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Template */}
          <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h2 className="text-white font-semibold mb-3">Email Template <span className="text-xs text-[#6a9090]">(optional — leave blank for full AI)</span></h2>
            <textarea value={template} onChange={e => setTemplate(e.target.value)} rows={5}
              placeholder="Hi {name}, I came across your business and wanted to reach out..."
              className="w-full px-4 py-3 rounded-lg text-sm text-white outline-none resize-none"
              style={{ background: '#111c1c', border: '1px solid #1e3232' }} />
            <p className="text-xs text-[#6a9090] mt-1">{template.length} characters</p>
          </div>

          {/* Settings */}
          <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h2 className="text-white font-semibold mb-4">Send Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-[#6a9090] mb-2">Language</label>
                <div className="flex gap-2">
                  {LANGS.map(l => (
                    <button key={l.value} onClick={() => setLanguage(l.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${language === l.value ? 'text-white' : 'text-[#6a9090] border border-[#1e3232] hover:border-[#4ecdc4]/40'}`}
                      style={language === l.value ? { background: '#4ecdc4', color: '#080f0f' } : {}}>
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#6a9090] mb-2">Sending Speed</label>
                <select value={speed} onChange={e => setSpeed(e.target.value)}
                  className="px-4 py-2 rounded-lg text-sm text-white outline-none w-full"
                  style={{ background: '#111c1c', border: '1px solid #1e3232' }}>
                  {SPEEDS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleGenerate} disabled={generating || leads.length === 0}
              className="flex-1 py-3 rounded-lg text-sm font-medium border border-[#4ecdc4]/30 text-[#4ecdc4] hover:border-[#4ecdc4]/60 disabled:opacity-40 transition-colors">
              {generating ? 'Generating...' : '✨ Generate Preview'}
            </button>
            <button onClick={() => setConfirm(true)} disabled={selectedLeads.size === 0 || !preview || sending}
              className="flex-1 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-opacity hover:opacity-90"
              style={{ background: '#e8806a' }}>
              {sending ? 'Sending...' : `Launch Campaign (${selectedLeads.size})`}
            </button>
          </div>
          {status && <p className="text-sm text-[#4ecdc4]">{status}</p>}
        </div>

        {/* Preview */}
        <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
          <h2 className="text-white font-semibold mb-4">Email Preview</h2>
          {preview ? (
            <div>
              <p className="text-[#e8806a] text-sm font-medium mb-3">Subject: {preview.subject}</p>
              <div className="p-4 rounded-lg text-sm text-[#cde0de] leading-relaxed whitespace-pre-wrap" style={{ background: '#111c1c' }}>
                {preview.body}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-[#6a9090] text-sm">
              Click &quot;Generate Preview&quot; to see a sample email
            </div>
          )}
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="p-8 rounded-2xl border max-w-md w-full mx-4" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
            <h3 className="text-white font-bold text-xl mb-2">Launch Campaign?</h3>
            <p className="text-[#6a9090] text-sm mb-6">
              You are about to send personalised emails to <strong className="text-white">{selectedLeads.size} leads</strong> in <strong className="text-white">{language}</strong>.
              Estimated time: ~{Math.round(selectedLeads.size * (speed === 'normal' ? 4.5 : 11.5))} minutes.
            </p>
            <div className="flex gap-3">
              <button onClick={handleLaunch} className="flex-1 py-3 rounded-lg font-semibold text-white" style={{ background: '#e8806a' }}>Confirm & Send</button>
              <button onClick={() => setConfirm(false)} className="flex-1 py-3 rounded-lg text-[#6a9090] border border-[#1e3232] hover:border-[#4ecdc4]/40">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
