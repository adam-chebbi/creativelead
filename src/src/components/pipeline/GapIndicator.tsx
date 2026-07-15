import { OpportunityGap } from '@/types';

export function GapIndicator({ gap }: { gap: OpportunityGap }) {
  return (
    <div className={`opportunity-gap ${gap.detected ? 'detected' : 'ok'}`}>
      <span className="gap-icon" style={{ color: gap.detected ? (gap.severity === 'critical' ? 'var(--color-danger)' : gap.severity === 'moderate' ? 'var(--color-warning)' : 'var(--color-text-muted)') : 'var(--color-success)' }}>
        {gap.detected ? '✕' : '✓'}
      </span>
      <div className="gap-text">
        <strong>{gap.label}</strong>
        <span className="gap-detail">{gap.detail}</span>
      </div>
    </div>
  );
}
