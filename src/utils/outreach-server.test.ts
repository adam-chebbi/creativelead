import { describe, it, expect } from 'vitest';

describe('outreach-server utilities', () => {
  interface LeadContext {
    id: string;
    businessName: string;
    category: string | null;
    city: string | null;
    rating: number | null;
    reviewCount: number | null;
    website: string | null;
    phone: string | null;
    email: string | null;
    enrichment: {
      emails: string[];
      linkedinUrl: string | null;
      facebookUrl: string | null;
      instagramUrl: string | null;
      tiktokUrl: string | null;
      youtubeUrl: string | null;
    } | null;
    opportunity: {
      detectedGaps: any;
      recommendedService: string | null;
    } | null;
  }

  function getLeadContextText(ctx: LeadContext): string {
    const parts: string[] = [];
    parts.push(`Business name: ${ctx.businessName}`);
    parts.push(`Category/Industry: ${ctx.category || 'Not specified'}`);
    parts.push(`City: ${ctx.city || 'Not specified'}`);
    if (ctx.rating != null) parts.push(`Rating: ${ctx.rating}/5`);
    if (ctx.reviewCount != null) parts.push(`Review count: ${ctx.reviewCount}`);
    if (ctx.website) parts.push(`Website: ${ctx.website}`);
    if (ctx.phone) parts.push(`Phone: ${ctx.phone}`);
    if (ctx.email) parts.push(`Email: ${ctx.email}`);
    const socials: string[] = [];
    if (ctx.enrichment?.linkedinUrl) socials.push('LinkedIn');
    if (ctx.enrichment?.facebookUrl) socials.push('Facebook');
    if (ctx.enrichment?.instagramUrl) socials.push('Instagram');
    if (ctx.enrichment?.tiktokUrl) socials.push('TikTok');
    if (ctx.enrichment?.youtubeUrl) socials.push('YouTube');
    if (socials.length > 0) parts.push(`Social profiles: ${socials.join(', ')}`);
    return parts.join('\n');
  }

  function getDetectedGapsText(ctx: LeadContext): string {
    const gaps = ctx.opportunity?.detectedGaps;
    if (!gaps || !Array.isArray(gaps) || gaps.length === 0) return 'No specific gaps detected.';
    const detected = gaps.filter((g: any) => g.detected);
    if (detected.length === 0) return 'No specific issues were found with this business.';
    return detected.map((g: any) => `- ${g.label}: ${g.detail}`).join('\n');
  }

  function getPositiveSignals(ctx: LeadContext): string {
    const signals: string[] = [];
    if (ctx.rating != null && ctx.rating >= 4.0) signals.push(`Strong rating of ${ctx.rating}/5`);
    if ((ctx.reviewCount ?? 0) >= 20) signals.push(`${ctx.reviewCount} reviews showing solid customer engagement`);
    if (ctx.phone) signals.push('Phone number available for contact');
    if (ctx.website) signals.push('Existing website presence');
    if (ctx.email) signals.push('Email listed');
    if (ctx.enrichment?.linkedinUrl) signals.push('LinkedIn profile found');
    if (ctx.enrichment?.facebookUrl) signals.push('Facebook profile found');
    if (signals.length === 0) signals.push('Business is listed and operational on Google Maps');
    return signals.join('; ');
  }

  function makeContext(overrides: Partial<LeadContext> = {}): LeadContext {
    return {
      id: 'lead-1',
      businessName: 'Test Business',
      category: 'Restaurant',
      city: 'Portland',
      rating: 4.2,
      reviewCount: 35,
      website: 'https://example.com',
      phone: '+1234567890',
      email: 'test@example.com',
      enrichment: {
        emails: ['contact@example.com'],
        linkedinUrl: 'https://linkedin.com/company/test',
        facebookUrl: null,
        instagramUrl: null,
        tiktokUrl: null,
        youtubeUrl: null,
      },
      opportunity: {
        detectedGaps: [
          { type: 'poor_website', label: 'Poor Website', severity: 'moderate', detail: 'No HTTPS, No analytics', detected: true },
          { type: 'no_social', label: 'No Social Presence', severity: 'critical', detail: 'No social profiles found', detected: true },
        ],
        recommendedService: 'Website Redesign + SEO Audit',
      },
      ...overrides,
    };
  }

  describe('getLeadContextText', () => {
    it('includes business name and category', () => {
      const text = getLeadContextText(makeContext());
      expect(text).toContain('Test Business');
      expect(text).toContain('Restaurant');
      expect(text).toContain('Portland');
    });

    it('includes enrichment data when available', () => {
      const ctx = makeContext();
      const text = getLeadContextText(ctx);
      expect(text).toContain('contact@example.com');
      expect(text).toContain('LinkedIn');
    });

    it('handles missing enrichment gracefully', () => {
      const ctx = makeContext({ enrichment: null });
      const text = getLeadContextText(ctx);
      expect(text).toContain('Test Business');
      expect(text).not.toContain('LinkedIn');
    });

    it('shows all social profiles found', () => {
      const ctx = makeContext({
        enrichment: {
          emails: [],
          linkedinUrl: 'https://linkedin.com/company/test',
          facebookUrl: 'https://facebook.com/test',
          instagramUrl: 'https://instagram.com/test',
          tiktokUrl: 'https://tiktok.com/@test',
          youtubeUrl: 'https://youtube.com/c/test',
        },
      });
      const text = getLeadContextText(ctx);
      expect(text).toContain('LinkedIn');
      expect(text).toContain('Facebook');
      expect(text).toContain('Instagram');
      expect(text).toContain('TikTok');
      expect(text).toContain('YouTube');
    });
  });

  describe('getDetectedGapsText', () => {
    it('returns detected gaps', () => {
      const text = getDetectedGapsText(makeContext());
      expect(text).toContain('Poor Website');
      expect(text).toContain('No Social Presence');
    });

    it('returns generic text when no gaps', () => {
      const ctx = makeContext({ opportunity: { detectedGaps: [], recommendedService: null } });
      expect(getDetectedGapsText(ctx)).toBe('No specific gaps detected.');
    });

    it('returns generic text when gaps is not an array', () => {
      const ctx = makeContext({ opportunity: { detectedGaps: null, recommendedService: null } });
      expect(getDetectedGapsText(ctx)).toBe('No specific gaps detected.');
    });

    it('returns only detected gaps not non-detected ones', () => {
      const ctx = makeContext({
        opportunity: {
          detectedGaps: [
            { type: 'poor_website', label: 'Poor Website', detected: true, detail: 'Issues found' },
            { type: 'no_ssl', label: 'No SSL', detected: false, detail: 'HTTPS active' },
          ],
          recommendedService: null,
        },
      });
      const text = getDetectedGapsText(ctx);
      expect(text).toContain('Poor Website');
      expect(text).not.toContain('No SSL');
    });
  });

  describe('getPositiveSignals', () => {
    it('includes rating signal when rating is high', () => {
      const text = getPositiveSignals(makeContext({ rating: 4.5 }));
      expect(text).toContain('Strong rating');
    });

    it('includes review signal when count is high', () => {
      const text = getPositiveSignals(makeContext({ reviewCount: 50 }));
      expect(text).toContain('50 reviews');
    });

    it('includes social profiles when found', () => {
      const text = getPositiveSignals(makeContext());
      expect(text).toContain('LinkedIn profile found');
    });

    it('shows default signal when nothing is positive', () => {
      const ctx = makeContext({
        rating: null,
        reviewCount: null,
        phone: null,
        website: null,
        email: null,
        enrichment: null,
      });
      const text = getPositiveSignals(ctx);
      expect(text).toContain('Business is listed and operational on Google Maps');
    });

    it('does not include low rating as positive signal', () => {
      const text = getPositiveSignals(makeContext({ rating: 2.0 }));
      expect(text).not.toContain('Strong rating');
    });
  });
});
