import { DealValueBreakdown } from '@/types';

export function ValueBreakdown({ breakdown }: { breakdown: DealValueBreakdown | undefined }) {
  if (!breakdown) return <p className="opportunity-muted">Not enough data to calculate breakdown</p>;
  return (
    <div className="value-breakdown">
      <div className="breakdown-row"><span>Base service price</span><span>${breakdown.baseServicePrice.toLocaleString()}</span></div>
      <div className="breakdown-row"><span>Gap multiplier ({breakdown.gapsFound} gaps × 0.15)</span><span>×{breakdown.gapMultiplier}</span></div>
      <div className="breakdown-row"><span>Category adjustment ({breakdown.industry || 'general'})</span><span>×{breakdown.categoryAdjustment}</span></div>
      <div className="breakdown-row total"><span>Estimated deal value</span><span>${breakdown.finalValue.toLocaleString()}</span></div>
    </div>
  );
}
