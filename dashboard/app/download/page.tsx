'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSessions } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

function detectOS(): 'windows' | 'macos' | 'linux' {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  return 'linux';
}

const WindowsIcon = () => (
  <svg viewBox="0 0 88 88" width="1em" height="1em" fill="currentColor"><path d="M0 12.402l35.687-4.86.016 34.423-35.67.203-.033-29.766zm35.67 33.53l-.015 33.91-35.64-4.904.016-29.324 35.64.318zm4.326-39.03L87.314 0v41.26l-47.318.376V6.902zm0 39.012l47.318.376V87.31l-47.318-6.68v-34.72z" /></svg>
);
const AppleIcon = () => (
  <svg viewBox="0 0 384 512" width="1em" height="1em" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>
);
const LinuxIcon = () => (
  <svg viewBox="0 0 448 512" width="1em" height="1em" fill="currentColor"><path d="M440 254.3c0-42.8-14.8-102.2-46.7-145.2-19.1-25.8-40.4-38.6-40.4-38.6-6-4.5-9.2-14.2-12-21.5C335.5 35 321 16.7 312 11c-14.4-9.2-34.1-10.9-45.7-10.9-52 0-97.1 23.3-131 66-17.9 22.7-32.6 42-45.7 65.5-10.7 19.1-19.1 40.5-24.3 62-6 24.3-8.1 46.1-9.5 67.5-.6 9.5-1 18.6-1 27.6 0 11.2-.5 25.8 4.3 40.5 5 15.2 13.8 28.6 26.2 39.5-3.1 9.8-5.7 19.8-5.7 29.5 0 22.1 15 42 36.7 45.4 7.6 1.2 15.5-1.4 21.7-6.2 2.4-1.9 4.3-3.8 6.4-6l14.3-15.5c4.3 10.9 11.2 21.2 20.5 30 11.4 10.7 26.7 17.6 41 18.1H238c14.3-.5 29.5-7.4 41-18.1 9.3-8.8 16.2-19.1 20.5-30l14.3 15.5c2.1 2.1 4 4.3 6.4 6 6.2 4.8 14 7.4 21.7 6.2 21.7-3.3 36.7-23.3 36.7-45.4 0-9.8-2.6-19.8-5.7-29.5 12.4-10.9 21.2-24.3 26.2-39.5 4.7-14.8 4.3-29.3 4.3-40.5 0-9.5-.4-18.1-1-27.6-1.4-21.4-3.6-43.1-9.5-67.5-5.2-21.5-13.6-42.9-24.3-62-13.1-23.5-27.8-42.8-45.7-65.5-33.9-42.7-79-66-131-66-11.6 0-31.3 1.7-45.7 10.9-9 5.7-23.5 24-28.9 38-2.8 7.3-6 17-12 21.5 0 0-21.3 12.8-40.4 38.6C14.8 152.1 0 211.5 0 254.3c0 36.7 15 89.8 42.4 135 15.7 25.7 34.3 47.9 50 63.8v4.8c0 30.2 24.5 54.7 54.7 54.7h253.8c30.2 0 54.7-24.5 54.7-54.7v-4.8c15.7-16 34.3-38.1 50-63.8 27.4-45.2 42.4-98.3 42.4-135zm-289.7 75.9c-12.4 0-22.4-10-22.4-22.4 0-12.4 10-22.4 22.4-22.4 12.4 0 22.4 10 22.4 22.4 0 12.4-10 22.4-22.4 22.4zm147.6 0c-12.4 0-22.4-10-22.4-22.4 0-12.4 10-22.4 22.4-22.4 12.4 0 22.4 10 22.4 22.4 0 12.4-10 22.4-22.4 22.4z"/></svg>
);

const DOWNLOADS = [
  { os: 'windows', label: 'Windows', ext: '.exe',      icon: <WindowsIcon />, size: '~85 MB', filename: 'CreativeLeads-Worker-Setup.exe' },
  { os: 'macos',   label: 'macOS',   ext: '.dmg',      icon: <AppleIcon />, size: '~90 MB', filename: 'CreativeLeads-Worker.dmg' },
  { os: 'linux',   label: 'Linux',   ext: '.AppImage', icon: <LinuxIcon />, size: '~80 MB', filename: 'CreativeLeads-Worker.AppImage' },
];

export default function DownloadPage() {
  const [os, setOs] = useState<string>('windows');
  const [copied, setCopied] = useState(false);
  const [downloads, setDownloads] = useState(DOWNLOADS);
  const { data: sessionsData } = useQuery({ queryKey: ['sessions'], queryFn: () => getSessions({ limit: 10 }) });

  useEffect(() => {
    setOs(detectOS());
    fetch('/downloads/manifest.json')
      .then(r => r.json())
      .then(manifest => {
        setDownloads(prev => prev.map(d => {
          const m = manifest[d.os];
          return m ? { ...d, filename: m.file, size: (m.sizeMB || d.size).toString().replace('MB','') + ' MB' } : d;
        }));
      })
      .catch(err => console.error('Failed to load manifest', err));
  }, []);

  const workerSessions = sessionsData?.workerSessions ?? [];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2">Download Creative Leads Worker</h1>
      <p className="text-[#6a9090] mb-10">Install the Creative Leads Worker on your machine to start collecting leads automatically.</p>

      {/* Download buttons */}
      <div className="grid md:grid-cols-3 gap-4 mb-10">
        {downloads.map(d => (
          <div key={d.os} className={`p-6 rounded-xl border cursor-pointer transition-all ${
            os === d.os ? 'border-[#4ecdc4]' : 'border-[#1e3232] hover:border-[#2a4444]'
          }`} style={{ background: '#0d1a1a' }}>
            <div className="text-3xl mb-3">{d.icon}</div>
            <h3 className="text-white font-semibold mb-1">{d.label}</h3>
            <p className="text-xs text-[#6a9090] mb-4">{d.ext} · {d.size} · v2.0.0</p>
            {os === d.os && <span className="text-xs px-2 py-0.5 rounded-full mb-3 inline-block" style={{ background: 'rgba(78,205,196,0.15)', color: '#4ecdc4' }}>Recommended for your OS</span>}
            <a href={`/downloads/${d.filename}`} className="block text-center w-full py-2.5 rounded-lg text-sm font-medium text-white mt-2 transition-opacity hover:opacity-90"
              style={{ background: os === d.os ? '#e8806a' : '#1e3232' }}>
              Download {d.label}
            </a>
          </div>
        ))}
      </div>

      {/* Setup guide */}
      <div className="p-6 rounded-xl border mb-8" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <h2 className="text-white font-semibold mb-6">Setup Guide</h2>
        <div className="space-y-6">
          {[
            { n: '1', title: 'Download and install', desc: 'Download the worker for your operating system above and run the installer.' },
            { n: '2', title: 'Connect to Dashboard', desc: 'Click the "Connect New Worker" button in Settings to link the app to your account.' },
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
