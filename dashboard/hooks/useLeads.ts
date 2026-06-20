import { useState, useEffect } from 'react';
import type { Lead } from '../lib/types';
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useLeads(userId: string | undefined) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLeads([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    let eventSource: EventSource | null = null;

    const init = async () => {
      setLoading(true);

      // 1. Fetch initial leads via standard API call
      try {
        const session = await getSession();
        const headers: HeadersInit = {};
        if (session?.accessToken) {
          headers.Authorization = `Bearer ${session.accessToken}`;
        }
        
        const res = await fetch(`${API_URL}/api/dashboard/leads`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (mounted && data.leads) {
            setLeads(data.leads);
          }
        }
      } catch (err) {
        console.error('Failed to fetch initial leads:', err);
      } finally {
        if (mounted) setLoading(false);
      }

      // 2. Subscribe to Realtime Updates via SSE
      const session = await getSession();
      if (session?.accessToken && mounted) {
        const token = session.accessToken;
        eventSource = new EventSource(`${API_URL}/api/dashboard/stream?token=${encodeURIComponent(token)}`);

        eventSource.addEventListener('leads:new', (e) => {
          if (mounted) {
            try {
              const data = JSON.parse(e.data);
              // Server sends { count: number, leads: Lead[] }
              if (data.leads && Array.isArray(data.leads)) {
                setLeads((prev) => [...data.leads, ...prev]);
              }
            } catch (err) {
              console.error('Failed to parse SSE leads:new event:', err);
            }
          }
        });

        eventSource.addEventListener('leads:update', (e) => {
          if (mounted) {
            try {
              const data = JSON.parse(e.data);
              if (data.lead && data.lead.id) {
                setLeads((prev) => prev.map(l => l.id === data.lead.id ? { ...l, ...data.lead } : l));
              }
            } catch (err) {
              console.error('Failed to parse SSE leads:update event:', err);
            }
          }
        });

        eventSource.onerror = (err) => {
          console.error('SSE Error:', err);
          eventSource?.close();
          // Minimal retry logic could be added here
        };
      }
    };

    init();

    return () => {
      mounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [userId]);

  return { leads, loading };
}
