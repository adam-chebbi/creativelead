'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Lead } from '@/types';
import { fetchLeadsFromApi, patchLeadOnServer } from './useLeadStore';

export function useLeadsQuery(params?: Record<string, string>) {
  return useQuery<Lead[]>({
    queryKey: ['leads', params],
    queryFn: () => fetchLeadsFromApi(params),
  });
}

export function useLeadUpdateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) => patchLeadOnServer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

export function useLeadInvalidator() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['leads'] });
}
