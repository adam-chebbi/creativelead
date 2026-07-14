import { useMemo } from 'react';
import { ImportResult } from '@/types';
import { countRealReviews } from '@/utils/reviews';

export function useLeadStats(result: ImportResult | null) {
  return useMemo(() => {
    const totalLeads = result?.leads.length ?? 0;
    const totalErrors = result?.errors.length ?? 0;
    const totalReviews = result?.leads.reduce((sum, l) => sum + countRealReviews(l.reviews), 0) ?? 0;

    return { totalLeads, totalErrors, totalReviews };
  }, [result]);
}
