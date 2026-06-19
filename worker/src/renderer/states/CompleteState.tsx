import React from 'react';

interface Props { data: any; onNewSession: () => void; }

export default function CompleteState({ data, onNewSession }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[500px] px-8 text-center">
      <div className="text-5xl mb-6">✅</div>
      <h1 className="text-xl font-bold text-white mb-2">Session Complete</h1>
      <p className="text-sm mb-8" style={{ color: '#6a9090' }}>Your leads have been synced to the dashboard.</p>

      <div className="grid grid-cols-3 gap-4 w-full max-w-sm mb-8">
        {[
          { label: 'Leads',   value: data?.leadsCollected   ?? 0, color: '#4ecdc4' },
          { label: 'Reviews', value: data?.reviewsCollected ?? 0, color: '#e8806a' },
          { label: 'Synced',  value: data?.leadsCollected   ?? 0, color: '#27c93f' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl" style={{ background: '#162424' }}>
            <p className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs" style={{ color: '#6a9090' }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3 w-full max-w-sm">
        <button onClick={onNewSession}
          className="flex-1 py-3 rounded-xl font-semibold text-white" style={{ background: '#e8806a' }}>
          Start New Session
        </button>
        <button onClick={() => window.autoreach.openDashboard()}
          className="flex-1 py-3 rounded-xl text-sm border" style={{ borderColor: '#1e3232', color: '#4ecdc4' }}>
          View Dashboard ↗
        </button>
      </div>
    </div>
  );
}
