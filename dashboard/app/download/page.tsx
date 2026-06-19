'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getWorkerToken, getSessions } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

function detectOS(): 'windows' | 'macos' | 'linux' {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  return 'linux';
}

const DOWNLOADS = [
  { os: 'windows', label: 'Windows', ext: '.exe', icon: '🪟', size: '~85 MB' },
  { os: 'macos',   label: 'macOS',   ext: '.dmg', icon: '🍎', size: '~90 MB' },
  { os: 'linux',   label: 'Linux',   ext: '.AppImage', icon: '🐧', size: '~80 MB' },
];

export default function DownloadPage() {
  const [os, setOs] = useState<string>('windows');
  const [copied, setCopied] = useState(false);
  const { data: tokenData } = useQuery({ queryKey: ['worker-token'], queryFn: getWorkerToken });
  const { data: sessionsData } = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions({ limit: 10 }) });

  useEffect(() => { setOs(detectOS()); }, []);

  const token = tokenData?.workerToken ?? '';
  const workerSessions = sessionsData?.workerSessions ?? [];

  const copyToken = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Download Worker</h1>
      <p className="text-[#6a9090] mb-10">Install the desktop worker on your machine to start collecting leads.</p>

      {/* Download buttons */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {DOWNLOADS.map(d => (
          <div key={d.os} className={`p-6 rounded-xl border cursor-pointer transition-all ${
            os === d.os ? 'border-[#4ecdc4]' : 'border-[#1e3232] hover:border-[#2a4444]'
          }`} style={{ background: '#0d1a1a' }}>
            <div className="text-3xl mb-3">{d.icon}</div>
            <h3 className="text-white font-semibold mb-1">{d.label}</h3>
            <p className="text-xs text-[#6a9090] mb-4">{d.ext} · {d.size} · v2.0.0</p>
            {os === d.os && <span className="text-xs px-2 py-0.5 rounded-full mb-3 inline-block" style={{ background: 'rgba(78,205,196,0.15)', color: '#4ecdc4' }}>Recommended for your OS</span>}
            <button className="w-full py-2.5 rounded-lg text-sm font-medium text-white mt-2 transition-opacity hover:opacity-90"
              style={{ background: os === d.os ? '#e8806a' : '#1e3232' }}>
              Download {d.label}
            </button>
          </div>
        ))}
      </div>

      {/* Setup guide */}
      <div className="p-6 rounded-xl border mb-8" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-6">Setup Guide</h2>
        <div className="space-y-6">
          {[
            { n: '1', title: 'Download and install', desc: 'Download the worker for your operating system above and run the installer.' },
            { n: '2', title: 'Open the worker app', desc: 'Launch AutoReach Worker. It will ask you to paste your worker token.' },
            { n: '3', title: 'Paste your token and connect', desc: 'Copy your token from the box below and paste it into the worker. Click Connect.' },
          ].map(s => (
            <div key={s.n} className="flex gap-4">
              <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: '#4ecdc4', color: '#080f0f' }}>{s.n}</span>
              <div>
                <p className="text-white font-medium">{s.title}</p>
                <p className="text-[#6a9090] text-sm mt-1">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Token */}
      <div className="p-6 rounded-xl border mb-8" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-2">Your Worker Token</h2>
        <p className="text-xs text-[#6a9090] mb-4">⚠️ Keep this secret. Never share it with anyone.</p>
        <div className="flex items-center gap-3">
          <code className="flex-1 px-4 py-3 rounded-lg font-mono text-xs text-[#4ecdc4] break-all" style={{ background: '#111c1c' }}>
            {token || 'Loading...'}
          </code>
          <button onClick={copyToken} className="px-4 py-3 rounded-lg text-sm font-medium border border-[#4ecdc4]/30 text-[#4ecdc4] hover:border-[#4ecdc4]/60 shrink-0">
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Connected workers */}
      <div className="p-6 rounded-xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-4">Connected Workers</h2>
        {workerSessions.length === 0 ? (
          <p className="text-[#6a9090] text-sm">No workers connected yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[#6a9090] border-b" style={{ borderColor: '#1e3232' }}>
                <th className="text-left pb-3">Machine</th>
                <th className="text-left pb-3">OS</th>
                <th className="text-left pb-3">Last Seen</th>
                <th className="text-left pb-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: '#1e3232' }}>
              {workerSessions.map((ws: any) => (
                <tr key={ws.id}>
                  <td className="py-3 text-white">{ws.machineName}</td>
                  <td className="py-3 text-[#6a9090] capitalize">{ws.platform}</td>
                  <td className="py-3 text-[#6a9090] text-xs">{formatDateTime(ws.lastPing)}</td>
                  <td className="py-3">
                    <span className={`flex items-center gap-1 text-xs w-fit px-2 py-0.5 rounded-full ${
                      ws.status === 'online' ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'
                    }`}>
                      {ws.status === 'online' && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                      {ws.status}
                    </span>
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
