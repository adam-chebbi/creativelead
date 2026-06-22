import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useLeadStream() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let source: EventSource;
    let retryTimer: NodeJS.Timeout;

    function connect() {
      // Connect to the API bridge SSE endpoint
      source = new EventSource('/api/dashboard/stream');

      source.addEventListener('lead-found', (e: any) => {
        try {
          // Trigger a re-fetch of leads and stats
          queryClient.invalidateQueries({ queryKey: ['leads'] });
          queryClient.invalidateQueries({ queryKey: ['stats'] });
        } catch (err) {}
      });

      source.addEventListener('scraping-status', (e: any) => {
        try {
          queryClient.invalidateQueries({ queryKey: ['sessions'] });
          queryClient.invalidateQueries({ queryKey: ['stats'] });
        } catch (err) {}
      });

      source.addEventListener('auth-state', (e: any) => {
        try {
          queryClient.invalidateQueries({ queryKey: ['stats'] });
        } catch (err) {}
      });

      source.onerror = () => {
        source.close();
        // Auto-reconnect after 5 seconds if connection lost
        retryTimer = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      clearTimeout(retryTimer);
      if (source) source.close();
    };
  }, [queryClient]);
}
