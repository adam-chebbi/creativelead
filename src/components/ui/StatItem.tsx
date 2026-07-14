import React from 'react';
import { useCountUp } from '@/hooks';

export interface StatItemProps {
  label: string;
  value: number | string;
  animateCount?: boolean;
  color?: string;
  valueStyle?: React.CSSProperties;
}

export const StatItem: React.FC<StatItemProps> = ({ label, value, animateCount = false, color, valueStyle }) => {
  const displayValue = animateCount && typeof value === 'number' ? useCountUp(value, 600) : value;

  return (
    <div className="stat-item">
      <span className="stat-value" style={{ color, ...valueStyle }}>
        {displayValue}
      </span>
      <span className="stat-label">{label}</span>
    </div>
  );
};
