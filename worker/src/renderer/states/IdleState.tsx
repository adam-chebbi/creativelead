import React, { useState, useEffect } from 'react';
import { Play, Eye } from 'lucide-react';

interface Props { onStarted: (sessionId: string) => void; }

export default function IdleState({ onStarted }: Props) {
  const [city, setCity]         = useState('');
  const [bizType, setBizType]   = useState('');
  const [maxResults, setMax]    = useState(200);
  const [scrapeReviews, setSR]  = useState(true);
  const [jobCount, setJobCount] = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [log, setLog]           = useState<string[]>([]);

  useEffect(() => {
    window.autoreach.getConfig().then(res => {
      if (res.ok) setJobCount(res.data?.jobs?.length ?? 0);
    });
    window.autoreach.onStatus((d) => {
      setLog(prev => [d.msg, ...prev].slice(0, 20));
    });
  }, []);

  const handleStart = async () => {
    if (!city.trim() || !bizType.trim()) { setError('Enter city and business type.'); return; }
    setLoading(true); setError('');
    const res = await window.autoreach.startScraping({ city, businessType: bizType, maxResults, scrapeReviews });
    setLoading(false);
    if (res.ok && res.sessionId) onStarted(res.sessionId);
    else setError(res.error || 'Failed to start scraping.');
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <span className="text-green-400 text-sm font-medium">Connected</span>
        {jobCount > 0 && <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ background: '#162424', color: '#4ecdc4' }}>{jobCount} jobs waiting</span>}
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#6a9090' }}>City</label>
          <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Tunis"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: '#0a1414', border: '1px solid #1e3232', color: '#cde0de' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: '#6a9090' }}>Business Type</label>
          <input value={bizType} onChange={e => setBizType(e.target.value)} placeholder="e.g. coffee shops"
            className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{ background: '#0a1414', border: '1px solid #1e3232', color: '#cde0de' }} />
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs mb-1" style={{ color: '#6a9090' }}>Max Results</label>
            <input type="number" value={maxResults} onChange={e => setMax(parseInt(e.target.value))}
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: '#0a1414', border: '1px solid #1e3232', color: '#cde0de' }} />
          </div>
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setSR(!scrapeReviews)}
                className={`w-9 h-5 rounded-full transition-colors relative ${scrapeReviews ? 'bg-teal' : 'bg-border'}`}
                style={{ background: scrapeReviews ? '#4ecdc4' : '#1e3232' }}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${scrapeReviews ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
              <span className="text-xs" style={{ color: '#6a9090' }}>Reviews</span>
            </label>
          </div>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
      </div>

      <div className="flex gap-3 mb-6">
        <button onClick={handleStart} disabled={loading}
          className="flex-1 py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: '#e8806a' }}>
          {loading ? 'Starting...' : <span className="flex items-center justify-center gap-2"><Play className="w-4 h-4" /> Start Scraping</span>}
        </button>
        <button onClick={() => window.autoreach.watchBrowser()}
          className="px-4 py-3 rounded-xl text-sm border flex items-center justify-center gap-2" style={{ borderColor: '#1e3232', color: '#6a9090' }}>
          <Eye className="w-4 h-4" /> Watch
        </button>
      </div>

      {/* Recent log */}
      {log.length > 0 && (
        <div className="rounded-xl p-4" style={{ background: '#0a1414' }}>
          {log.map((l, i) => <p key={i} className="text-xs mb-1" style={{ color: '#6a9090' }}>{l}</p>)}
        </div>
      )}

      <button onClick={() => window.autoreach.clearToken()}
        className="mt-4 text-xs" style={{ color: '#6a9090' }}>Disconnect</button>
    </div>
  );
}
