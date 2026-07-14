import { describe, it, expect, vi } from 'vitest';
import {
  computeScores,
  computeWebsiteQuality,
  computeReviewReputation,
  computeCompetitionScore,
  computeGrowthScore,
  computeSeoWeakness,
  computeOpportunityScore,
  computeClassification,
  hashScoringInputs,
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

describe('computeWebsiteQuality', () => {
  it('returns 0 and insufficient for null signals', () => {
    const result = computeWebsiteQuality(null);
    expect(result.score).toBe(0);
    expect(result.insufficient).toBe(true);
  });

  it('returns > 0 for a reachable site with good signals', () => {
    const result = computeWebsiteQuality({
      reachable: true,
      isHttps: true,
      hasViewportMeta: true,
      seoScore: 80,
      performanceScore: 70,
      loadTimeMs: 400,
      hasAnalytics: true,
      analyticsTools: ['Google Analytics'],
      hasChatbot: false,
      chatbotTools: [],
      hasTitle: true,
      hasMetaDescription: true,
      hasStructuredData: true,
      missingAltCount: 1,
      totalImgTags: 10,
    });
    expect(result.score).toBeGreaterThan(50);
    expect(result.insufficient).toBe(false);
  });

  it('produces different scores for different signal qualities', () => {
    const good = computeWebsiteQuality({
      reachable: true, isHttps: true, hasViewportMeta: true,
      seoScore: 90, performanceScore: 90, loadTimeMs: 300,
      hasAnalytics: true, analyticsTools: ['GA'],
      hasChatbot: true, chatbotTools: ['Intercom'],
      hasTitle: true, hasMetaDescription: true, hasStructuredData: true,
      missingAltCount: 0, totalImgTags: 10,
    });
    const poor = computeWebsiteQuality({
      reachable: true, isHttps: false, hasViewportMeta: false,
      seoScore: 20, performanceScore: 20, loadTimeMs: 6000,
      hasAnalytics: false, analyticsTools: [],
      hasChatbot: false, chatbotTools: [],
      hasTitle: false, hasMetaDescription: false, hasStructuredData: false,
      missingAltCount: 5, totalImgTags: 5,
    });
    expect(good.score).toBeGreaterThan(poor.score);
  });
});

describe('computeReviewReputation', () => {
  it('returns insufficient for null rating', () => {
    const result = computeReviewReputation(null, 100);
    expect(result.score).toBe(0);
    expect(result.insufficient).toBe(true);
  });

  it('returns insufficient for zero rating', () => {
    const result = computeReviewReputation(0, 100);
    expect(result.insufficient).toBe(true);
  });

  it('returns 100 for perfect rating with many reviews', () => {
    const result = computeReviewReputation(5, 500);
    expect(result.score).toBe(100);
    expect(result.insufficient).toBe(false);
  });

  it('applies penalty for low review count', () => {
    const highCount = computeReviewReputation(4.5, 500);
    const lowCount = computeReviewReputation(4.5, 3);
    expect(lowCount.score).toBeLessThan(highCount.score);
  });
});

describe('computeCompetitionScore', () => {
  it('returns 50 and insufficient for null reviewCount', () => {
    const result = computeCompetitionScore(null);
    expect(result.score).toBe(50);
    expect(result.insufficient).toBe(true);
  });

  it('returns 0 for zero reviews', () => {
    const result = computeCompetitionScore(0);
    expect(result.score).toBe(0);
    expect(result.insufficient).toBe(false);
  });
});

describe('computeClassification', () => {
  it('returns Hot for >= 75', () => {
    expect(computeClassification(75)).toBe('Hot');
    expect(computeClassification(100)).toBe('Hot');
  });
  it('returns Warm for 40-74', () => {
    expect(computeClassification(40)).toBe('Warm');
    expect(computeClassification(60)).toBe('Warm');
  });
  it('returns Cold for < 40', () => {
    expect(computeClassification(39)).toBe('Cold');
    expect(computeClassification(0)).toBe('Cold');
  });
});

describe('computeScores', () => {
  it('produces different scores for different inputs', () => {
    const leads: ScoringInput[] = [
      makeLead({
        businessName: 'High Quality',
        rating: 4.9,
        reviewCount: 800,
        website: 'https://great-site.com',
        socialLinksCount: 5,
        websiteIntel: {
          reachable: true, isHttps: true, hasViewportMeta: true,
          seoScore: 95, performanceScore: 90, loadTimeMs: 200,
          hasAnalytics: true, analyticsTools: ['GA'],
          hasChatbot: true, chatbotTools: ['Intercom'],
          hasTitle: true, hasMetaDescription: true, hasStructuredData: true,
          missingAltCount: 0, totalImgTags: 15,
        },
      }),
      makeLead({
        businessName: 'Medium Quality',
        rating: 3.5,
        reviewCount: 25,
        website: 'https://ok-site.com',
        socialLinksCount: 2,
        websiteIntel: {
          reachable: true, isHttps: true, hasViewportMeta: true,
          seoScore: 60, performanceScore: 50, loadTimeMs: 2000,
          hasAnalytics: true, analyticsTools: ['GA'],
          hasChatbot: false, chatbotTools: [],
          hasTitle: true, hasMetaDescription: true, hasStructuredData: false,
          missingAltCount: 3, totalImgTags: 8,
        },
      }),
      makeLead({
        businessName: 'Low Quality',
        rating: 2.0,
        reviewCount: 2,
        website: null,
        socialLinksCount: 0,
        websiteIntel: null,
      }),
      makeLead({
        businessName: 'No Data',
        rating: null,
        reviewCount: null,
        website: null,
        socialLinksCount: 0,
        websiteIntel: null,
      }),
    ];

    const results = leads.map((l) => computeScores(l));

    const overallScores = results.map((r) => r.overallScore);
    const uniqueOverall = new Set(overallScores);
    expect(uniqueOverall.size).toBeGreaterThan(1);

    const subScoreKeys: (keyof typeof results[0])[] = [
      'opportunityScore', 'competitionScore', 'growthScore',
      'seoWeakness', 'websiteQuality', 'reviewReputation',
    ];

    for (const key of subScoreKeys) {
      const values = results.map((r) => r[key]);
      const unique = new Set(values);
      expect(unique.size).toBeGreaterThan(
        1,
        `Expected more than one distinct value for ${key}, got ${JSON.stringify([...unique])}`,
      );
    }
  });
});

describe('hashScoringInputs', () => {
  it('produces different hashes for different inputs', () => {
    const leadA = makeLead({ rating: 4.5, reviewCount: 100, website: 'https://a.com' });
    const leadB = makeLead({ rating: 2.0, reviewCount: 5, website: 'https://b.com' });
    expect(hashScoringInputs(leadA)).not.toBe(hashScoringInputs(leadB));
  });

  it('produces the same hash for the same inputs', () => {
    const base = makeLead({ rating: 3.0, reviewCount: 50, website: 'https://same.com' });
    const a = hashScoringInputs(base);
    const b = hashScoringInputs({ ...base, id: 'different-id' });
    expect(a).toBe(b);
  });
});

describe('computeScores with 20+ synthetic leads', () => {
  it('produces non-identical scores across diverse leads', () => {
    const ratings = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 4.9];
    const reviewCounts = [0, 1, 5, 10, 25, 50, 100, 200, 500, 800];
    const websites = [null, 'https://basic.com', 'https://good.com', 'https://excellent.com'];

    const leads: ScoringInput[] = [];

    let idx = 0;
    for (const r of ratings) {
      for (const rc of reviewCounts.slice(0, 3)) {
        for (const w of websites.slice(0, 2)) {
          if (leads.length >= 25) break;
          leads.push(
            makeLead({
              id: `synth-${idx++}`,
              businessName: `Synth Lead ${idx}`,
              category: idx % 2 === 0 ? 'Restaurant' : 'Plumber',
              city: idx % 3 === 0 ? 'Portland' : idx % 3 === 1 ? 'Austin' : 'Denver',
              rating: r,
              reviewCount: rc,
              website: w,
              socialLinksCount: idx % 4,
              websiteIntel: w
                ? {
                    reachable: true,
                    isHttps: r > 3.0,
                    hasViewportMeta: rc > 10,
                    seoScore: 30 + (rc % 70),
                    performanceScore: 30 + (r * 10),
                    loadTimeMs: w === 'https://excellent.com' ? 200 : w === 'https://good.com' ? 800 : 3000,
                    hasAnalytics: rc > 50,
                    analyticsTools: rc > 50 ? ['GA'] : [],
                    hasChatbot: r > 4.0,
                    chatbotTools: r > 4.0 ? ['Intercom'] : [],
                    hasTitle: true,
                    hasMetaDescription: r > 3.0,
                    hasStructuredData: rc > 100,
                    missingAltCount: rc > 100 ? 0 : 3,
                    totalImgTags: 10,
                  }
                : null,
            }),
          );
        }
      }
    }

    expect(leads.length).toBeGreaterThanOrEqual(20);

    const results = leads.map((l) => computeScores(l));

    const overallScores = results.map((r) => r.overallScore);
    const uniqueOverall = new Set(overallScores);
    expect(uniqueOverall.size).toBeGreaterThan(1);

    const subScoreKeys: (keyof typeof results[0])[] = [
      'opportunityScore', 'competitionScore', 'growthScore',
      'seoWeakness', 'websiteQuality', 'reviewReputation',
    ];

    for (const key of subScoreKeys) {
      const values = results.map((r) => r[key]);
      const unique = new Set(values);
      expect(unique.size).toBeGreaterThan(
        1,
        `Regression: ${key} produced only one distinct value (${[...unique][0]}) across ${leads.length} diverse leads`,
      );
    }

    const insufficientCounts = results.map((r) => r.insufficientData.length);
    const uniqueInsufficient = new Set(insufficientCounts);
    expect(uniqueInsufficient.size).toBeGreaterThan(1);
  });
});
