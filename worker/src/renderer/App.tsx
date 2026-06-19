import React, { useEffect, useState } from 'react';
import ConnectState   from './states/ConnectState';
import IdleState      from './states/IdleState';
import ScrapingState  from './states/ScrapingState';
import CompleteState  from './states/CompleteState';

export type AppState = 'connect' | 'idle' | 'scraping' | 'complete';

declare global {
  interface Window {
    autoreach: {
      connectWorker:  (token: string) => Promise<{ ok: boolean; error?: string }>;
      clearToken:     () => Promise<void>;
      getConfig:      () => Promise<{ ok: boolean; data?: any }>;
      startScraping:  (config: object) => Promise<{ ok: boolean; sessionId?: string; error?: string }>;
      stopScraping:   (sessionId?: string) => Promise<void>;
      pauseScraping:  () => Promise<void>;
      resumeCaptcha:  () => Promise<void>;
      watchBrowser:   () => Promise<void>;
      openDashboard:  () => Promise<void>;
      installUpdate:  () => Promise<void>;
      onAuthState:       (cb: (d: any) => void) => void;
      onStatus:          (cb: (d: any) => void) => void;
      onLeadFound:       (cb: (d: any) => void) => void;
      onProgress:        (cb: (d: any) => void) => void;
      onQueueSize:       (cb: (n: number) => void) => void;
      onCaptcha:         (cb: () => void) => void;
      onComplete:        (cb: (d: any) => void) => void;
      onError:           (cb: (d: any) => void) => void;
      onUpdateAvailable: (cb: (d: any) => void) => void;
      onUpdateProgress:  (cb: (d: any) => void) => void;
      onUpdateReady:     (cb: () => void) => void;
    };
  }
}

export default function App() {
  const [state, setState]           = useState<AppState>('connect');
  const [sessionId, setSessionId]   = useState<string | undefined>();
  const [completeData, setComplete] = useState<any>(null);
  const [updateBanner, setUpdateBanner] = useState<string | null>(null);
  const [updateReady, setUpdateReady]   = useState(false);

  useEffect(() => {
    const ar = window.autoreach;
    ar.onAuthState((d) => setState(d.state));
    ar.onComplete((d) => { setComplete(d); setState('complete'); });
    ar.onError(() => setState('idle'));
    ar.onUpdateAvailable((d) => setUpdateBanner(`Update v${d.version} available — downloading...`));
    ar.onUpdateProgress((d) => setUpdateBanner(`Downloading update... ${d.percent}%`));
    ar.onUpdateReady(() => { setUpdateBanner('Update ready — restart to apply'); setUpdateReady(true); });
  }, []);

  const handleStarted = (sid: string) => { setSessionId(sid); setState('scraping'); };
  const handleStopped = () => setState('idle');
  const handleNewSession = () => { setComplete(null); setState('idle'); };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#111c1c' }}>
      {/* Update banner */}
      {updateBanner && (
        <div className="px-4 py-2 text-xs flex items-center justify-between" style={{ background: '#162424', borderBottom: '1px solid #1e3232' }}>
          <span style={{ color: '#4ecdc4' }}>{updateBanner}</span>
          {updateReady && (
            <button onClick={() => window.autoreach.installUpdate()}
              className="px-3 py-1 rounded text-xs font-medium text-white" style={{ background: '#e8806a' }}>
              Restart Now
            </button>
          )}
        </div>
      )}

      {/* Logo bar */}
      <div className="px-5 py-4 flex items-center gap-2 border-b" style={{ borderColor: '#1e3232' }}>
        <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold" style={{ background: 'linear-gradient(135deg, #4ecdc4, #e8806a)' }}>CL</div>
        <span className="font-bold text-white text-sm">Creative<span style={{ color: '#4ecdc4' }}>Leads</span></span>
        <span className="ml-auto text-xs" style={{ color: '#6a9090' }}>Worker v2.0.0</span>
      </div>

      {/* Content */}
      <div className="flex-1">
        {state === 'connect'  && <ConnectState />}
        {state === 'idle'     && <IdleState onStarted={handleStarted} />}
        {state === 'scraping' && <ScrapingState sessionId={sessionId} onStopped={handleStopped} />}
        {state === 'complete' && <CompleteState data={completeData} onNewSession={handleNewSession} />}
      </div>
    </div>
  );
}
