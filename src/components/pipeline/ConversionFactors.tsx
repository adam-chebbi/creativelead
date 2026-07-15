import { ConversionFactor } from '@/types';

export function ConversionFactors({ factors }: { factors: ConversionFactor[] | undefined }) {
  if (!factors || factors.length === 0) return <p className="opportunity-muted">Not enough data to compute factors</p>;
  return (
    <div className="conversion-factors">
      {factors.map((f, i) => (
        <div key={i} className={`factor-row impact-${f.impact}`}>
          <span className="factor-name">{f.factor}</span>
          <span className="factor-reason">{f.reason}</span>
          <span className="factor-weight" style={{ color: f.impact === 'positive' ? 'var(--color-success)' : f.impact === 'negative' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>{f.weight > 0 ? '+' : ''}{f.weight}%</span>
        </div>
      ))}
    </div>
  );
}
