import React, { useState } from 'react';

export default function ConnectState() {
  const [token, setToken]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleConnect = async () => {
    if (!token.trim()) return;
    setLoading(true); setError('');
    const res = await window.autoreach.connectWorker(token.trim());
    setLoading(false);
    if (!res.ok) setError(res.error || 'Connection failed. Check your token.');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6" style={{ background: '#162424' }}>🔗</div>
      <h1 className="text-xl font-bold text-white mb-2">Connect to Creative Leads</h1>
      <p className="text-sm text-center mb-8" style={{ color: '#6a9090' }}>
        Paste your worker token from the Creative Leads dashboard download page.
      </p>

      <div className="w-full max-w-sm space-y-4">
        <textarea
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Paste your worker token here..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl text-sm font-mono resize-none outline-none"
          style={{ background: '#0a1414', border: '1px solid #1e3232', color: '#cde0de' }}
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          onClick={handleConnect}
          disabled={loading || !token.trim()}
          className="w-full py-3 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: '#e8806a' }}>
          {loading ? 'Connecting...' : 'Connect'}
        </button>
        <button
          onClick={() => window.autoreach.openDashboard()}
          className="w-full py-2 text-sm" style={{ color: '#6a9090' }}>
          Open Creative Leads dashboard to get your token ↗
        </button>
      </div>
    </div>
  );
}
