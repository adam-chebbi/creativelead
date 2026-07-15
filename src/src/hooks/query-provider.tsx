'use client';

import React, { useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
        gcTime: 30 * 60 * 1000,
      },
    },
  }));

  const [persister] = useState(() => createSyncStoragePersister({
    storage: typeof window !== 'undefined' ? window.localStorage : noopStorage,
    key: 'CREATIVELEAD_QUERY_CACHE',
  }));

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
