import React from 'react';
import { StatItem } from '@/components/ui';

export interface ImportSummaryStatsProps {
  totalLeads: number;
  totalReviews: number;
  totalErrors: number;
  source: string;
}

export const ImportSummaryStats: React.FC<ImportSummaryStatsProps> = ({ totalLeads, totalReviews, totalErrors, source }) => {
  return (
    <div className="stats-bar" style={{ marginBottom: '1.25rem' }}>
      <StatItem label="Leads" value={totalLeads} animateCount />
      <div className="stat-divider" />
      <StatItem label="Reviews" value={totalReviews} animateCount />
      <div className="stat-divider" />
      <StatItem 
        label="Format" 
        value={source} 
        valueStyle={{ textTransform: 'uppercase', fontSize: '0.9rem' }} 
      />
      <div className="stat-divider" />
      <StatItem 
        label="Schema" 
        value={totalErrors === 0 ? 'Valid' : `${totalErrors} err`} 
        color={totalErrors > 0 ? 'var(--color-danger)' : 'var(--color-success)'}
      />
    </div>
  );
};
