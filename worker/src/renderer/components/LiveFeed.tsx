import React, { useEffect, useRef, useState } from 'react';

interface FeedEvent { time: string; msg: string; type: string; }

const TYPE_COLORS: Record<string, string> = {
  info:    '#3b82f6',
  success: '#22c55e',
  warn:    '#f59e0b',
  error:   '#ef4444',
  system:  '#6a9090',
};

export default function LiveFeed({ events }: { events: FeedEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = 0;
    }
  }, [events, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    // If user scrolled down, stop auto-scroll
    setAutoScroll(containerRef.current.scrollTop < 10);
  };

  if (events.length === 0) return null;

  return (
    <div>
      <p className="text-xs mb-2" style={{ color: '#6a9090' }}>Live feed</p>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="rounded-xl p-3 max-h-48 overflow-y-auto space-y-1"
        style={{ background: '#0a1414' }}>
        {events.map((e, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full" style={{ background: TYPE_COLORS[e.type] ?? '#6a9090', marginTop: '4px' }} />
            <span className="shrink-0" style={{ color: '#6a9090' }}>{e.time}</span>
            <span style={{ color: '#cde0de' }}>{e.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
