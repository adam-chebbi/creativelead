import { describe, it, expect } from 'vitest';
import {
  computeScores,
  computeWebsiteQuality,
  computeReviewReputation,
  computeCompetitionScore,
  computeGrowthScore,
  computeSeoWeakness,
  computeOpportunityScore,
  ScoringInput,
} from './scoring-server';

function makeLead(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    id: `lead-${Math.random().toString(36).slice(2, 8)}`,
    businessName: 'Test Business',
    category: 'Restaurant',
    city: 'Portland',
    rating: null,
    reviewCount: null,
    website: null,
    socialLinksCount: 0,
    websiteIntel: null,
    ...overrides,
  };
}

describe('Pack 9 — Integration QA: Scoring Variance', () => {
  it('overall AI scores are not all identical across a varied batch', () => {
    const leads: ScoringInput[] = [
      makeLead({ id: 'l1', rating: 2.0, reviewCount: 3, website: null }),
      makeLead({ id: 'l2', rating: 4.9, reviewCount: 500, website: 'https://example.com', websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 90, performanceScore: 80, loadTimeMs: 200, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: true, chatbotTools: ['Intercom'], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 0, totalImgTags: 10 } }),
      makeLead({ id: 'l3', rating: 3.5, reviewCount: 20, website: 'https://poor-site.com', websiteIntel: { reachable: true, isHttps: false, hasViewportMeta: false, seoScore: 20, performanceScore: 10, loadTimeMs: 5000, hasAnalytics: false, analyticsTools: [], hasChatbot: false, chatbotTools: [], hasTitle: false, hasMetaDescription: false, hasStructuredData: false, missingAltCount: 5, totalImgTags: 5 } }),
      makeLead({ id: 'l4', rating: 4.2, reviewCount: 150, website: 'https://good-site.com', websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 80, performanceScore: 75, loadTimeMs: 600, hasAnalytics: true, analyticsTools: ['GA4', 'Meta Pixel'], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 2, totalImgTags: 8 } }),
      makeLead({ id: 'l5', rating: 1.5, reviewCount: 1, website: null }),
      makeLead({ id: 'l6', rating: 4.0, reviewCount: 800, website: 'https://big-site.com', websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 95, performanceScore: 90, loadTimeMs: 150, hasAnalytics: true, analyticsTools: ['GA4', 'GTM', 'Meta Pixel', 'Hotjar'], hasChatbot: true, chatbotTools: ['Intercom', 'Drift'], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 0, totalImgTags: 20 } }),
      makeLead({ id: 'l7', rating: null, reviewCount: null, website: null }),
      makeLead({ id: 'l8', rating: 3.0, reviewCount: 10, website: 'https://medium.com', websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 50, performanceScore: 50, loadTimeMs: 2000, hasAnalytics: false, analyticsTools: [], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: true, hasStructuredData: false, missingAltCount: 3, totalImgTags: 5 } }),
    ];

    const results = leads.map(l => computeScores(l));
    const overallScores = results.map(r => r.overallScore);
    const uniqueScores = new Set(overallScores);

    expect(uniqueScores.size).toBeGreaterThan(1);
  });

  it('each sub-score produces more than one distinct value across the batch', () => {
    const leads: ScoringInput[] = [
      makeLead({ id: 's1', rating: 2.0, reviewCount: 3, website: null }),
      makeLead({ id: 's2', rating: 4.9, reviewCount: 500, website: 'https://good.com', websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 90, performanceScore: 80, loadTimeMs: 200, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: true, chatbotTools: ['Intercom'], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 1, totalImgTags: 10 } }),
      makeLead({ id: 's3', rating: null, reviewCount: null, website: null }),
      makeLead({ id: 's4', rating: 4.0, reviewCount: 100, website: 'https://ok.com', websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: false, seoScore: 60, performanceScore: 50, loadTimeMs: 1500, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: false, hasStructuredData: true, missingAltCount: 0, totalImgTags: 5 } }),
    ];

    const results = leads.map(l => computeScores(l));

    const subScoreKeys: (keyof typeof results[0])[] = [
      'opportunityScore', 'competitionScore', 'growthScore',
      'seoWeakness', 'websiteQuality', 'reviewReputation',
    ];

    for (const key of subScoreKeys) {
      const values = results.map(r => r[key] as number);
      const unique = new Set(values);
      expect(unique.size).toBeGreaterThan(1);
    }
  });
});

describe('Pack 9 — Integration QA: Insufficient Data Flags', () => {
  it('flags leads with no rating as insufficient for review_reputation', () => {
    const lead = makeLead({ rating: null, reviewCount: 50 });
    const result = computeScores(lead);
    expect(result.insufficientData).toContain('review_reputation');
  });

  it('flags leads with no rating and no review count as insufficient for competition', () => {
    const lead = makeLead({ rating: null, reviewCount: null });
    const result = computeScores(lead);
    expect(result.insufficientData).toContain('competition');
  });

  it('does not flag leads with complete data', () => {
    const lead = makeLead({
      rating: 4.0,
      reviewCount: 50,
      website: 'https://example.com',
      websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 80, performanceScore: 70, loadTimeMs: 500, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 0, totalImgTags: 5 },
    });
    const result = computeScores(lead);
    expect(result.insufficientData).toHaveLength(0);
  });
});

describe('Pack 9 — Integration QA: Website vs No Website', () => {
  it('leads with a website produce different opportunity scores than those without', () => {
    const withSite = makeLead({
      id: 'w1',
      website: 'https://example.com',
      websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 80, performanceScore: 70, loadTimeMs: 500, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 0, totalImgTags: 5 },
    });
    const withoutSite = makeLead({ id: 'w2', website: null });

    const withResult = computeScores(withSite);
    const withoutResult = computeScores(withoutSite);

    expect(withResult.websiteQuality).toBeGreaterThan(withoutResult.websiteQuality);
    expect(withResult.seoWeakness).toBeLessThanOrEqual(withoutResult.seoWeakness);
  });
});

describe('Pack 9 — Integration QA: Scoring Idempotency', () => {
  it('same input produces same scores every time', () => {
    const lead = makeLead({
      rating: 4.0,
      reviewCount: 100,
      website: 'https://example.com',
      websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 80, performanceScore: 70, loadTimeMs: 500, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 0, totalImgTags: 5 },
    });

    const run1 = computeScores(lead);
    const run2 = computeScores(lead);
    const run3 = computeScores(lead);

    expect(run1.overallScore).toBe(run2.overallScore);
    expect(run2.overallScore).toBe(run3.overallScore);
    expect(run1.websiteQuality).toBe(run2.websiteQuality);
    expect(run1.reviewReputation).toBe(run2.reviewReputation);
    expect(run1.competitionScore).toBe(run2.competitionScore);
    expect(run1.growthScore).toBe(run2.growthScore);
    expect(run1.seoWeakness).toBe(run2.seoWeakness);
    expect(run1.opportunityScore).toBe(run2.opportunityScore);
    expect(run1.classification).toBe(run2.classification);
  });

  it('changing a single input changes only related sub-scores', () => {
    const base = makeLead({
      id: 'iso-1',
      rating: 4.0,
      reviewCount: 100,
      website: 'https://example.com',
      websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 80, performanceScore: 70, loadTimeMs: 500, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 0, totalImgTags: 5 },
    });
    const changed = makeLead({
      id: 'iso-2',
      rating: 2.0,
      reviewCount: 100,
      website: 'https://example.com',
      websiteIntel: { reachable: true, isHttps: true, hasViewportMeta: true, seoScore: 80, performanceScore: 70, loadTimeMs: 500, hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: false, chatbotTools: [], hasTitle: true, hasMetaDescription: true, hasStructuredData: true, missingAltCount: 0, totalImgTags: 5 },
    });

    const baseResult = computeScores(base);
    const changedResult = computeScores(changed);

    expect(baseResult.reviewReputation).not.toBe(changedResult.reviewReputation);
    expect(baseResult.websiteQuality).toBe(changedResult.websiteQuality);
    expect(baseResult.competitionScore).toBe(changedResult.competitionScore);
  });
});
