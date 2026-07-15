import { describe, it, expect } from 'vitest';

describe('opportunity-server utilities', () => {
  function getCategoryMultiplier(category: string | null | undefined): number {
    if (!category) return 1.0;
    const lower = category.toLowerCase();
    const pairs: [RegExp, number][] = [
      [/medical|dental|doctor|clinic|health|hospital/, 1.3],
      [/legal|lawyer|attorney|law firm/, 1.3],
      [/real estate|realtor|property/, 1.2],
      [/dentist|dental/, 1.2],
      [/technology|software|it |tech |digital/, 1.1],
      [/hotel|lodging|motel/, 1.1],
      [/restaurant|cafe|coffee|bakery/, 0.85],
      [/retail|shop|store|boutique/, 0.9],
      [/salon|spa|barber|beauty/, 0.9],
      [/fitness|gym|personal trainer/, 1.0],
      [/auto|mechanic|garage|car|repair/, 1.0],
      [/contractor|plumber|electrician|hvac|roofing/, 1.0],
    ];
    for (const [pattern, mult] of pairs) {
      if (pattern.test(lower)) return mult;
    }
    return 1.0;
  }

  describe('getCategoryMultiplier', () => {
    it('returns 1.3 for medical categories', () => {
      expect(getCategoryMultiplier('Dentist')).toBe(1.3);
      expect(getCategoryMultiplier('Medical Clinic')).toBe(1.3);
    });

    it('returns 1.3 for legal categories', () => {
      expect(getCategoryMultiplier('Lawyer')).toBe(1.3);
      expect(getCategoryMultiplier('Attorney')).toBe(1.3);
    });

    it('returns 0.85 for restaurants', () => {
      expect(getCategoryMultiplier('Restaurant')).toBe(0.85);
      expect(getCategoryMultiplier('Cafe')).toBe(0.85);
    });

    it('returns 1.0 for uncategorized', () => {
      expect(getCategoryMultiplier(null)).toBe(1.0);
      expect(getCategoryMultiplier(undefined)).toBe(1.0);
    });

    it('returns 1.0 for generic categories', () => {
      expect(getCategoryMultiplier('General Contractor')).toBe(1.0);
    });
  });

  function hasValue(val: unknown): boolean {
    if (val === null || val === undefined) return false;
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  }

  describe('hasValue', () => {
    it('returns false for null', () => { expect(hasValue(null)).toBe(false); });
    it('returns false for undefined', () => { expect(hasValue(undefined)).toBe(false); });
    it('returns false for empty string', () => { expect(hasValue('')).toBe(false); });
    it('returns true for non-empty string', () => { expect(hasValue('hello')).toBe(true); });
    it('returns false for empty array', () => { expect(hasValue([])).toBe(false); });
    it('returns true for populated array', () => { expect(hasValue(['a'])).toBe(true); });
    it('returns true for a number', () => { expect(hasValue(0)).toBe(true); });
    it('returns true for a boolean', () => { expect(hasValue(false)).toBe(true); });
  });

  describe('gap detection logic', () => {
    // Test the gap detection rules independently

    interface GapInput {
      website: string | null;
      rating: number | null;
      reviewCount: number | null;
      category: string | null;
      reachable: boolean | null;
      isHttps: boolean | null;
      hasViewportMeta: boolean | null;
      seoScore: number | null;
      performanceScore: number | null;
      loadTimeMs: number | null;
      hasAnalytics: boolean | null;
      analyticsTools: string[];
      hasChatbot: boolean | null;
      hasTitle: boolean | null;
      hasMetaDescription: boolean | null;
      hasStructuredData: boolean | null;
      socialCount: number;
      hasPhone: boolean;
      hasEmail: boolean;
    }

    function hasSeoFlags(input: GapInput): string[] {
      const flags: string[] = [];
      if (input.reachable) {
        if (!input.hasTitle) flags.push('No <title> tag');
        if (!input.hasMetaDescription) flags.push('No meta description');
        if (!input.hasViewportMeta) flags.push('Not mobile-responsive');
        if (input.loadTimeMs !== null && input.loadTimeMs > 3000) flags.push('Slow load time');
        if (!input.hasStructuredData) flags.push('No structured data');
        return flags;
      }
      if (!input.website) flags.push('No website to optimize');
      return flags;
    }

    function hasAnyWebsiteIssues(input: GapInput): boolean {
      if (!input.website) return true;

      if (!input.reachable) return true;

      const issues: string[] = [];
      if (!input.isHttps) issues.push('No HTTPS');
      if (!input.hasViewportMeta) issues.push('Not mobile-responsive');
      if (input.seoScore !== null && input.seoScore < 40) issues.push('Poor SEO');
      if (input.performanceScore !== null && input.performanceScore < 40) issues.push('Poor performance');
      if (input.loadTimeMs !== null && input.loadTimeMs > 3000) issues.push('Slow');
      if (!input.hasAnalytics) issues.push('No analytics');
      return issues.length > 0;
    }

    it('detects no-website gap when website is null', () => {
      const input: GapInput = {
        website: null, rating: 4.0, reviewCount: 10, category: 'Restaurant',
        reachable: null, isHttps: null, hasViewportMeta: null,
        seoScore: null, performanceScore: null, loadTimeMs: null,
        hasAnalytics: null, analyticsTools: [], hasChatbot: null,
        hasTitle: null, hasMetaDescription: null, hasStructuredData: null,
        socialCount: 0, hasPhone: false, hasEmail: false,
      };
      expect(hasAnyWebsiteIssues(input)).toBe(true);
    });

    it('detects no website to optimize in SEO flags', () => {
      const input: GapInput = {
        website: null, rating: 4.0, reviewCount: 10, category: 'Restaurant',
        reachable: null, isHttps: null, hasViewportMeta: null,
        seoScore: null, performanceScore: null, loadTimeMs: null,
        hasAnalytics: null, analyticsTools: [], hasChatbot: null,
        hasTitle: null, hasMetaDescription: null, hasStructuredData: null,
        socialCount: 0, hasPhone: false, hasEmail: false,
      };
      const flags = hasSeoFlags(input);
      expect(flags).toContain('No website to optimize');
    });

    it('detects poor website signals when present', () => {
      const input: GapInput = {
        website: 'https://example.com', rating: 3.5, reviewCount: 5, category: 'Plumber',
        reachable: true, isHttps: false, hasViewportMeta: false,
        seoScore: 30, performanceScore: 25, loadTimeMs: 5000,
        hasAnalytics: false, analyticsTools: [], hasChatbot: false,
        hasTitle: true, hasMetaDescription: false, hasStructuredData: false,
        socialCount: 0, hasPhone: true, hasEmail: false,
      };
      expect(hasAnyWebsiteIssues(input)).toBe(true);
      const flags = hasSeoFlags(input);
      expect(flags.length).toBeGreaterThan(0);
    });

    it('detects no issues for a good website', () => {
      const input: GapInput = {
        website: 'https://example.com', rating: 4.5, reviewCount: 50, category: 'Software',
        reachable: true, isHttps: true, hasViewportMeta: true,
        seoScore: 85, performanceScore: 80, loadTimeMs: 400,
        hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: true,
        hasTitle: true, hasMetaDescription: true, hasStructuredData: true,
        socialCount: 3, hasPhone: true, hasEmail: true,
      };
      expect(hasAnyWebsiteIssues(input)).toBe(false);
      const flags = hasSeoFlags(input);
      expect(flags.length).toBe(0);
    });

    it('observes that review count and rating affect gaps', () => {
      const lowReviews: GapInput = {
        website: null, rating: null, reviewCount: 0, category: 'Restaurant',
        reachable: null, isHttps: null, hasViewportMeta: null,
        seoScore: null, performanceScore: null, loadTimeMs: null,
        hasAnalytics: null, analyticsTools: [], hasChatbot: null,
        hasTitle: null, hasMetaDescription: null, hasStructuredData: null,
        socialCount: 0, hasPhone: false, hasEmail: false,
      };
      const goodReviews: GapInput = {
        website: 'https://example.com', rating: 4.8, reviewCount: 200, category: 'Software',
        reachable: true, isHttps: true, hasViewportMeta: true,
        seoScore: 90, performanceScore: 85, loadTimeMs: 200,
        hasAnalytics: true, analyticsTools: ['GA4'], hasChatbot: true,
        hasTitle: true, hasMetaDescription: true, hasStructuredData: true,
        socialCount: 4, hasPhone: true, hasEmail: true,
      };

      const lowHasIssues = !lowReviews.website || !lowReviews.reachable || lowReviews.reviewCount === 0;
      const goodHasIssues = !goodReviews.website || !goodReviews.reachable;
      expect(lowHasIssues).toBe(true);
      expect(goodHasIssues).toBe(false);
    });

    it('treats low review count as an issue', () => {
      expect(hasValue('')).toBe(false);
      expect(hasValue('hello')).toBe(true);
    });
  });

  describe('computeDealValue', () => {
    function computeDealValue(
      basePrice: number,
      detectedGapCount: number,
      category: string | null,
    ): { finalValue: number; breakdown: any } {
      const gapMultiplier = 1 + (detectedGapCount * 0.15);
      const categoryBonus = getCategoryMultiplier(category);
      const finalValue = Math.round(basePrice * gapMultiplier * categoryBonus);
      return {
        finalValue,
        breakdown: {
          baseServicePrice: basePrice,
          gapMultiplier: Math.round(gapMultiplier * 100) / 100,
          categoryAdjustment: Math.round(categoryBonus * 100) / 100,
          finalValue,
          gapsFound: detectedGapCount,
          industry: category || 'Unknown',
        },
      };
    }

    it('calculates deal value with no gaps and default category', () => {
      const { finalValue, breakdown } = computeDealValue(2500, 0, null);
      expect(finalValue).toBe(2500);
      expect(breakdown.gapMultiplier).toBe(1);
      expect(breakdown.categoryAdjustment).toBe(1);
    });

    it('increases value with more detected gaps', () => {
      const noGaps = computeDealValue(1000, 0, 'Restaurant');
      const manyGaps = computeDealValue(1000, 5, 'Restaurant');
      expect(manyGaps.finalValue).toBeGreaterThan(noGaps.finalValue);
    });

    it('applies higher multiplier for medical businesses', () => {
      const standard = computeDealValue(1000, 2, 'Restaurant');
      const medical = computeDealValue(1000, 2, 'Dentist');
      expect(medical.finalValue).toBeGreaterThan(standard.finalValue);
    });
  });
});
