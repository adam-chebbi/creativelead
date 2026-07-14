/**
 * sentiment.ts — Lightweight client-side review sentiment heuristic.
 * Assigns a sentiment label to a piece of review text using keyword matching.
 * No external API, no data leaves the browser.
 */

export type Sentiment = 'positive' | 'neutral' | 'negative';

const POSITIVE_TERMS = [
  'excellent', 'amazing', 'outstanding', 'fantastic', 'great', 'wonderful',
  'brilliant', 'superb', 'perfect', 'best', 'love', 'loved', 'recommend',
  'recommended', 'helpful', 'professional', 'friendly', 'exceptional',
  'impressed', 'satisfied', 'happy', 'pleased', 'top', 'awesome', 'good',
  // French
  'excellent', 'super', 'parfait', 'formidable', 'magnifique', 'génial',
  'très bien', 'recommande', 'professionnel', 'satisfait', 'contente',
];

const NEGATIVE_TERMS = [
  'terrible', 'awful', 'horrible', 'worst', 'bad', 'poor', 'disappointing',
  'disappointed', 'waste', 'never', 'avoid', 'scam', 'rude', 'unprofessional',
  'useless', 'pathetic', 'overpriced', 'broken', 'dirty', 'disgusting',
  'worst', 'hate', 'hated', 'failed', 'failure', 'slow', 'late', 'wrong',
  // French
  'terrible', 'nul', 'mauvais', 'décevant', 'déçu', 'éviter', 'arnaque',
  'impoli', 'non professionnel', 'inutile', 'sale', 'dégueulasse',
];

export function scoreSentiment(text: string | null | undefined): Sentiment {
  if (!text || text.trim().length === 0) return 'neutral';

  const lower = text.toLowerCase();
  let score = 0;

  for (const term of POSITIVE_TERMS) {
    if (lower.includes(term)) score += 1;
  }
  for (const term of NEGATIVE_TERMS) {
    if (lower.includes(term)) score -= 1;
  }

  if (score > 0) return 'positive';
  if (score < 0) return 'negative';
  return 'neutral';
}

/**
 * Aggregate sentiment across all reviews of a lead.
 * Returns 'positive' if the majority of reviews are positive, etc.
 */
export function aggregateSentiment(reviews: Array<{ review_text?: string | null }>): Sentiment {
  if (!reviews || reviews.length === 0) return 'neutral';

  let pos = 0, neg = 0, neu = 0;
  for (const r of reviews) {
    const s = scoreSentiment(r.review_text);
    if (s === 'positive') pos++;
    else if (s === 'negative') neg++;
    else neu++;
  }

  if (pos > neg && pos > neu) return 'positive';
  if (neg > pos && neg > neu) return 'negative';
  return 'neutral';
}

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  positive: '👍 Positive',
  neutral: '😐 Neutral',
  negative: '👎 Negative',
};

export const SENTIMENT_COLOR: Record<Sentiment, string> = {
  positive: 'var(--color-success)',
  neutral: 'var(--color-text-muted)',
  negative: 'var(--color-danger)',
};
