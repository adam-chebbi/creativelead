import React, { useState } from 'react';
import { Link as LinkIcon, ExternalLink, Globe } from 'lucide-react';

export default function ConnectState() {
  const [token, setToken]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleBrowserAuth = async () => {
    setLoading(true); setError('');
    const res = await (window as any).autoreach.startBrowserAuth();
    if (!res.ok) {
      setLoading(false);
      setError(res.error || 'Failed to start browser authentication.');
    }
    // If successful, it polls and auto-updates state, so we keep loading=true
  };

  const handleManualConnect = async () => {
    if (!token.trim()) return;
    setLoading(true); setError('');
    const res = await (window as any).autoreach.connectWorker(token.trim());
    setLoading(false);
    if (!res.ok) setError(res.error || 'Connection failed. Check your token.');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#162424', color: '#4ecdc4' }}>
        <LinkIcon className="w-8 h-8" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">Connect to Creative Leads</h1>
      <p className="text-sm text-center mb-8" style={{ color: '#6a9090' }}>
        Sign in to link this worker to your account.
      </p>

      <div className="w-full max-w-sm space-y-4">
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        
        {!showManual ? (
          <>
            <button
              onClick={handleBrowserAuth}
              disabled={loading}
              className="w-full py-3 flex items-center justify-center gap-2 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#4ecdc4', color: '#080f0f' }}>
              <Globe className="w-4 h-4" />
              {loading ? 'Waiting for browser...' : 'Sign in with Browser'}
            </button>
            <button
              onClick={() => setShowManual(true)}
              disabled={loading}
              className="w-full py-2 text-sm text-[#6a9090] hover:text-white transition-colors">
              Use manual token instead
            </button>
          </>
        ) : (
          <>
            <textarea
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste your worker token here..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl text-sm font-mono resize-none outline-none"
              style={{ background: '#0a1414', border: '1px solid #1e3232', color: '#cde0de' }}
            />
            <button
              onClick={handleManualConnect}
              disabled={loading || !token.trim()}
              className="w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#e8806a' }}>
              {loading ? 'Connecting...' : 'Connect Manually'}
            </button>
            <button
              onClick={() => setShowManual(false)}
              disabled={loading}
              className="w-full py-2 text-sm text-[#6a9090] hover:text-white transition-colors">
              Back to browser sign-in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
