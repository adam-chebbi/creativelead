'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function DesktopAuthClient({ code }: { code: string }) {
  const [redirected, setRedirected] = useState(false);

  const deepLink = `autoreach://auth?code=${code}`;

  useEffect(() => {
    // Attempt to redirect to the desktop app automatically
    window.location.href = deepLink;
    setRedirected(true);
  }, [deepLink]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#080f0f] text-center px-4">
      <div className="max-w-sm w-full p-8 rounded-2xl border" style={{ background: '#0d1a1a', borderColor: '#1e3232' }}>
        <div className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{ background: '#162424', color: '#34d399' }}>
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">Authentication Successful</h1>
        <p className="text-sm mb-8" style={{ color: '#6a9090' }}>
          You can now close this tab. The Creative Leads desktop app should open automatically.
        </p>
        
        {redirected && (
          <p className="text-xs text-[#6a9090] mb-4">
            If the app didn't open, click the button below.
          </p>
        )}
        
        <a href={deepLink}
          className="block w-full py-3 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 mb-4"
          style={{ background: '#4ecdc4' }}>
          Open Desktop App
        </a>
        
        <Link href="/dashboard" className="text-sm hover:underline" style={{ color: '#e8806a' }}>
          Go to Web Dashboard
        </Link>
      </div>
    </div>
  );
}
