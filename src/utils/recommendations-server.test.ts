import { describe, it, expect } from 'vitest';

describe('recommendations-server utilities', () => {
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const EARTH_RADIUS_KM = 6371;
    const deg2rad = (deg: number) => deg * (Math.PI / 180);
    const dlat = deg2rad(lat2 - lat1);
    const dlon = deg2rad(lon2 - lon1);
    const a = Math.sin(dlat / 2) ** 2 +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dlon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
  }

  function categoryTokenize(cat: string | null | undefined): string[] {
    if (!cat) return [];
    return cat.toLowerCase().split(/[,/&]+/).map(s => s.trim()).filter(Boolean);
  }

  function cityMatch(a: string | null | undefined, b: string | null | undefined): boolean {
    if (!a || !b) return false;
    return a.toLowerCase().trim() === b.toLowerCase().trim();
  }

  describe('haversineDistance', () => {
    it('returns 0 for same point', () => {
      expect(haversineDistance(45.5, -122.6, 45.5, -122.6)).toBe(0);
    });

    it('calculates distance between Portland and Salem (~75km)', () => {
      const dist = haversineDistance(45.5152, -122.6784, 44.9429, -123.0351);
      expect(dist).toBeGreaterThan(60);
      expect(dist).toBeLessThan(90);
    });

    it('calculates distance between NYC and LA (~3940km)', () => {
      const dist = haversineDistance(40.7128, -74.006, 34.0522, -118.2437);
      expect(dist).toBeGreaterThan(3900);
      expect(dist).toBeLessThan(4000);
    });
  });

  describe('categoryTokenize', () => {
    it('splits comma-separated categories', () => {
      expect(categoryTokenize('Restaurant, Cafe')).toEqual(['restaurant', 'cafe']);
    });

    it('splits slash-separated categories', () => {
      expect(categoryTokenize('Pizza / Italian')).toEqual(['pizza', 'italian']);
    });

    it('removes empty tokens', () => {
      expect(categoryTokenize(' , Pizza, ')).toEqual(['pizza']);
    });

    it('returns empty array for null/undefined', () => {
      expect(categoryTokenize(null)).toEqual([]);
      expect(categoryTokenize(undefined)).toEqual([]);
    });
  });

  describe('cityMatch', () => {
    it('matches same city case-insensitively', () => {
      expect(cityMatch('Portland', 'portland')).toBe(true);
    });

    it('trims whitespace', () => {
      expect(cityMatch('  Portland  ', 'Portland')).toBe(true);
    });

    it('returns false for different cities', () => {
      expect(cityMatch('Portland', 'Salem')).toBe(false);
    });

    it('returns false when one is null', () => {
      expect(cityMatch(null, 'Portland')).toBe(false);
      expect(cityMatch('Portland', undefined)).toBe(false);
    });
  });

  describe('scoring logic', () => {
    function computeRankScore(params: {
      aiScore: number;
      conversionProbability: number;
      estimatedDealValue: number;
      gapCount: number;
      daysSinceUpdate: number;
      active: boolean;
    }): number {
      let score = params.aiScore * 0.45;
      score += params.conversionProbability * 0.20;
      score += Math.min(100, (params.estimatedDealValue / 10000) * 100) * 0.15;
      const recencyScore = Math.max(0, 100 - params.daysSinceUpdate * 5);
      score += recencyScore * 0.10;
      score += Math.min(100, params.gapCount * 15) * 0.10;
      if (!params.active) score *= 0.3;
      return Math.round(score);
    }

    it('higher AI score gives higher rank score', () => {
      const base = { conversionProbability: 50, estimatedDealValue: 5000, gapCount: 2, daysSinceUpdate: 5, active: true };
      const low = computeRankScore({ ...base, aiScore: 30 });
      const high = computeRankScore({ ...base, aiScore: 80 });
      expect(high).toBeGreaterThan(low);
    });

    it('higher conversion probability gives higher rank score', () => {
      const base = { aiScore: 50, estimatedDealValue: 5000, gapCount: 2, daysSinceUpdate: 5, active: true };
      const low = computeRankScore({ ...base, conversionProbability: 20 });
      const high = computeRankScore({ ...base, conversionProbability: 90 });
      expect(high).toBeGreaterThan(low);
    });

    it('higher deal value gives higher rank score', () => {
      const base = { aiScore: 50, conversionProbability: 50, gapCount: 2, daysSinceUpdate: 5, active: true };
      const low = computeRankScore({ ...base, estimatedDealValue: 1000 });
      const high = computeRankScore({ ...base, estimatedDealValue: 50000 });
      expect(high).toBeGreaterThan(low);
    });

    it('more gaps gives higher rank score', () => {
      const base = { aiScore: 50, conversionProbability: 50, estimatedDealValue: 5000, daysSinceUpdate: 5, active: true };
      const few = computeRankScore({ ...base, gapCount: 0 });
      const many = computeRankScore({ ...base, gapCount: 5 });
      expect(many).toBeGreaterThan(few);
    });

    it('reduces score for closed (won/lost) leads', () => {
      const base = { aiScore: 70, conversionProbability: 70, estimatedDealValue: 5000, gapCount: 3, daysSinceUpdate: 1 };
      const active = computeRankScore({ ...base, active: true });
      const closed = computeRankScore({ ...base, active: false });
      expect(closed).toBeLessThan(active);
    });

    it('rank score decreases with older leads', () => {
      const base = { aiScore: 50, conversionProbability: 50, estimatedDealValue: 5000, gapCount: 2, active: true };
      const recent = computeRankScore({ ...base, daysSinceUpdate: 1 });
      const old = computeRankScore({ ...base, daysSinceUpdate: 60 });
      expect(old).toBeLessThan(recent);
    });
  });

  describe('similarity scoring', () => {
    function computeSimilarity(params: {
      sharedCategory: boolean;
      sharedCity: boolean;
      distanceKm: number | null;
      ratingDiff: number;
      refRating: number;
    }): number {
      let score = 0;
      if (params.sharedCategory) score += 40;
      if (params.sharedCity) score += 30;
      if (params.distanceKm != null && params.distanceKm < 10) score += 20;
      else if (params.distanceKm != null && params.distanceKm < 50) score += 10;
      if (params.refRating > 0 && params.ratingDiff < 1.0) score += 10;
      return score;
    }

    it('same category and city gives high similarity', () => {
      const score = computeSimilarity({ sharedCategory: true, sharedCity: true, distanceKm: 2, ratingDiff: 0.3, refRating: 4.0 });
      expect(score).toBeGreaterThanOrEqual(90);
    });

    it('different category and city gives low similarity', () => {
      const score = computeSimilarity({ sharedCategory: false, sharedCity: false, distanceKm: 100, ratingDiff: 2.0, refRating: 4.0 });
      expect(score).toBe(0);
    });

    it('shared category contributes 40 points', () => {
      const score = computeSimilarity({ sharedCategory: true, sharedCity: false, distanceKm: null, ratingDiff: 2.0, refRating: 0 });
      expect(score).toBe(40);
    });
  });
});
