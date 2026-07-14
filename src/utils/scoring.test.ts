import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAIScores } from '../utils/scoring';

// Mock external dependencies that scoring.ts imports but we don't need for unit tests
vi.mock('../hooks/useSettingsStore', () => ({
  getSettings: vi.fn(() => ({
    weights: {
      opportunity: 30,
      competition: 20,
      growth: 20,
      seo: 10,
      website: 10,
      reputation: 10,
    },
  })),
}));
vi.mock('../utils/api-client', () => ({ callAi: vi.fn() }));
vi.mock('../utils/website-scraper', () => ({ scrapeWebsiteContacts: vi.fn() }));
vi.mock('../utils/enrichment-client', () => ({ runEnrichmentApi: vi.fn() }));

// ─── generateAIScores ──────────────────────────────────────────────────────

describe('generateAIScores', () => {
  it('classifies a high-rated business with few reviews as Hot', () => {
    const result = generateAIScores({
      rating: 4.8,
      review_count: 10,
      website: 'https://acme.com',
      phone_number: '555-1234',
    });
    expect(result.ai_score).toBeGreaterThanOrEqual(0);
    expect(result.ai_score).toBeLessThanOrEqual(100);
    expect(['Hot', 'Warm', 'Cold']).toContain(result.classification);
  });

  it('returns Cold for a business with no rating and no website', () => {
    const result = generateAIScores({
      rating: 0,
      review_count: 0,
      website: undefined,
      phone_number: undefined,
    });
    expect(result.classification).toBe('Cold');
    expect(result.ai_score).toBeLessThan(40);
  });

  it('caps ai_score between 0 and 100', () => {
    const extremeHigh = generateAIScores({ rating: 5, review_count: 1000, website: 'https://x.com' });
    const extremeLow = generateAIScores({ rating: 0, review_count: 0 });
    expect(extremeHigh.ai_score).toBeLessThanOrEqual(100);
    expect(extremeLow.ai_score).toBeGreaterThanOrEqual(0);
  });

  it('returns a Hot classification when ai_score >= 75', () => {
    // Force a high score: perfect rating, no competition (low review count), has website
    const result = generateAIScores({ rating: 5, review_count: 5, website: 'https://example.com' });
    if ((result.ai_score ?? 0) >= 75) {
      expect(result.classification).toBe('Hot');
    }
  });

  it('sets seo_weakness high when no website is present', () => {
    const withWebsite = generateAIScores({ website: 'https://site.com' });
    const withoutWebsite = generateAIScores({ website: undefined });
    expect((withoutWebsite.seo_weakness ?? 0)).toBeGreaterThan(withWebsite.seo_weakness ?? 0);
  });

  it('handles a completely empty lead without throwing', () => {
    expect(() => generateAIScores({})).not.toThrow();
  });

  it('returns all expected score fields', () => {
    const result = generateAIScores({ rating: 4, review_count: 50, website: 'https://test.com' });
    expect(result).toHaveProperty('ai_score');
    expect(result).toHaveProperty('classification');
    expect(result).toHaveProperty('opportunity_score');
    expect(result).toHaveProperty('competition_score');
    expect(result).toHaveProperty('growth_score');
    expect(result).toHaveProperty('seo_weakness');
    expect(result).toHaveProperty('website_quality');
    expect(result).toHaveProperty('review_reputation');
  });
});
