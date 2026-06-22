import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, Eye } from 'lucide-react';
import LiveFeed from '../components/LiveFeed';

interface Props { sessionId?: string; onStopped: () => void; }

export default function ScrapingState({ sessionId, onStopped }: Props) {
  const [progress, setProgress]   = useState({ collected: 0, total: 0, synced: 0 });
  const [queueSize, setQueueSize] = useState(0);
  const [captcha, setCaptcha]     = useState(false);
  const [events, setEvents]       = useState<{ time: string; msg: string; type: string }[]>([]);
  const [leads, setLeads]         = useState<{ name: string; address: string }[]>([]);

  useEffect(() => {
    window.autoreach.onProgress((d) => setProgress(d));
    window.autoreach.onQueueSize((n) => setQueueSize(n));
    window.autoreach.onCaptcha(() => setCaptcha(true));
    window.autoreach.onStatus((d) => {
      setEvents(prev => [d, ...prev].slice(0, 200));
    });
    window.autoreach.onLeadFound((d) => {
      setLeads(prev => [d, ...prev].slice(0, 50));
    });
  }, []);

  const handleStop = async () => {
    await window.autoreach.stopScraping(sessionId);
    onStopped();
  };

  const handleResume = async () => {
    await window.autoreach.resumeCaptcha();
    setCaptcha(false);
  };

  const pct = progress.total > 0 ? Math.round((progress.collected / progress.total) * 100) : 0;

  return (
    <div className="p-6">
      {/* CAPTCHA alert */}
      {captcha && (
        <div className="mb-4 p-4 rounded-xl border border-red-400/40" style={{ background: 'rgba(239,68,68,0.1)' }}>
          <p className="text-red-400 text-sm font-medium mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> CAPTCHA detected</p>
          <p className="text-xs mb-3" style={{ color: '#6a9090' }}>Please solve the CAPTCHA in the browser window, then click Resume.</p>
          <button onClick={handleResume} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#e8806a' }}>Resume</button>
        </div>
      )}

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-2" style={{ color: '#6a9090' }}>
          <span>{progress.collected} leads collected</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: '#1e3232' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: '#4ecdc4' }} />
        </div>
      </div>

      {/* Sync status */}
      {queueSize > 0 && (
        <p className="text-xs mb-4" style={{ color: '#6a9090' }}>{queueSize} leads pending sync...</p>
      )}

      {/* Disclaimer */}
      <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ background: '#0a1414', color: '#6a9090' }}>
        <AlertTriangle className="w-4 h-4 inline mr-1 -mt-0.5" /> The browser window is being controlled automatically. Do not click, type, or scroll inside it while scraping is running.
      </p>

      {/* Controls */}
      <div className="flex gap-3 mb-6">
        <button onClick={() => window.autoreach.pauseScraping()}
          className="flex-1 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#1e3232', color: '#6a9090' }}>Pause</button>
        <button onClick={handleStop}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium" style={{ background: '#162424', color: '#e8806a', border: '1px solid rgba(232,128,106,0.3)' }}>Stop</button>
        <button onClick={() => window.autoreach.watchBrowser()}
          className="px-4 py-2.5 rounded-xl text-sm border flex items-center justify-center" style={{ borderColor: '#1e3232', color: '#6a9090' }}><Eye className="w-4 h-4" /></button>
      </div>

      {/* Recent leads */}
      {leads.length > 0 && (
        <div className="mb-4">
          <p className="text-xs mb-2" style={{ color: '#6a9090' }}>Recently found:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {leads.slice(0, 8).map((l, i) => (
              <div key={i} className="px-3 py-2 rounded-lg text-xs" style={{ background: '#0a1414' }}>
                <span className="text-white font-medium">{l.name}</span>
                {l.address && <span className="ml-2" style={{ color: '#6a9090' }}>{l.address}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live feed */}
      <LiveFeed events={events} />
    </div>
  );
}
