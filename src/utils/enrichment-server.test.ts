import { describe, it, expect } from 'vitest';

describe('enrichment-server utilities', () => {
  describe('isValidUrl', () => {
    // Inline the function from enrichment-server.ts to test
    function isValidUrl(s: string): boolean {
      try {
        const u = s.startsWith('http') ? new URL(s) : new URL('https://' + s);
        return u.hostname.includes('.');
      } catch {
        return false;
      }
    }

    it('returns true for a valid URL with protocol', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('returns true for a valid URL without protocol', () => {
      expect(isValidUrl('example.com')).toBe(true);
    });

    it('returns false for an empty string', () => {
      expect(isValidUrl('')).toBe(false);
    });

    it('returns false for a bare word without a dot', () => {
      expect(isValidUrl('notaurl')).toBe(false);
    });

    it('returns true for subdomains', () => {
      expect(isValidUrl('https://sub.example.co.uk')).toBe(true);
    });
  });

  describe('extractDomain', () => {
    function extractDomain(url: string): string | null {
      try {
        const u = url.startsWith('http') ? new URL(url) : new URL('https://' + url);
        return u.hostname.replace(/^www\./, '');
      } catch {
        return null;
      }
    }

    it('extracts domain from full URL', () => {
      expect(extractDomain('https://www.example.com/page')).toBe('example.com');
    });

    it('strips www prefix', () => {
      expect(extractDomain('https://www.google.com')).toBe('google.com');
    });

    it('works without protocol', () => {
      expect(extractDomain('example.org')).toBe('example.org');
    });

    it('returns null for invalid URL', () => {
      expect(extractDomain('')).toBe(null);
    });
  });

  describe('scrapePage', () => {
    // Inline the scrape function to test it independently
    const SOCIAL_PATTERNS: Record<string, RegExp> = {
      linkedin: /linkedin\.com\/(company|in|school)\/[a-z0-9_-]+/i,
      facebook: /facebook\.com\/([a-z0-9._-]+)/i,
      instagram: /instagram\.com\/([a-z0-9._-]+)/i,
      tiktok: /tiktok\.com\/@?([a-z0-9._-]+)/i,
      youtube: /youtube\.com\/(c|channel|user|@[a-z0-9_-]+)/i,
    };

    interface SocialLinks {
      linkedin: string[];
      facebook: string[];
      instagram: string[];
      tiktok: string[];
      youtube: string[];
    }

    interface ScrapeResult {
      emails: { email: string; source: 'mailto' | 'text' }[];
      phones: { phone: string; source: 'tel' | 'text' }[];
      socialLinks: SocialLinks;
      pageTitle: string;
      description: string;
      rawText: string;
    }

    function scrapePage(html: string, baseUrl: string): ScrapeResult {
      const result: ScrapeResult = {
        emails: [],
        phones: [],
        socialLinks: { linkedin: [], facebook: [], instagram: [], tiktok: [], youtube: [] },
        pageTitle: '',
        description: '',
        rawText: html,
      };

      const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleM) result.pageTitle = titleM[1].trim();

      const descM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
      if (descM) result.description = descM[1].trim();

      const links: string[] = [];
      const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
      let am: RegExpExecArray | null;
      while ((am = anchorRegex.exec(html)) !== null) {
        links.push(am[1]);
      }

      for (const rawHref of links) {
        const href = rawHref.trim();

        if (href.startsWith('mailto:')) {
          const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
          if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            result.emails.push({ email, source: 'mailto' });
          }
          continue;
        }

        if (href.startsWith('tel:')) {
          const phone = href.replace(/^tel:/i, '').split(/[;?]/)[0].trim();
          if (phone) result.phones.push({ phone, source: 'tel' });
          continue;
        }

        try {
          const absolute = new URL(href, baseUrl).href;
          for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
            if (pattern.test(absolute)) {
              const key = platform as keyof SocialLinks;
              result.socialLinks[key].push(absolute);
            }
          }
        } catch {
          // relative URL that couldn't be resolved
        }
      }

      return result;
    }

    it('extracts title and description from HTML', () => {
      const html = `<html><head><title>Test Business</title>
        <meta name="description" content="Best pizza in Portland">
      </head><body></body></html>`;
      const result = scrapePage(html, 'https://example.com');
      expect(result.pageTitle).toBe('Test Business');
      expect(result.description).toBe('Best pizza in Portland');
    });

    it('extracts mailto emails', () => {
      const html = '<a href="mailto:info@example.com">Email us</a>';
      const result = scrapePage(html, 'https://example.com');
      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].email).toBe('info@example.com');
      expect(result.emails[0].source).toBe('mailto');
    });

    it('extracts tel links', () => {
      const html = '<a href="tel:+1234567890">Call us</a>';
      const result = scrapePage(html, 'https://example.com');
      expect(result.phones).toHaveLength(1);
      expect(result.phones[0].phone).toBe('+1234567890');
      expect(result.phones[0].source).toBe('tel');
    });

    it('detects social links', () => {
      const html = `<a href="https://linkedin.com/company/acme">LinkedIn</a>
        <a href="https://facebook.com/acme">Facebook</a>
        <a href="https://instagram.com/acme">Instagram</a>`;
      const result = scrapePage(html, 'https://example.com');
      expect(result.socialLinks.linkedin).toHaveLength(1);
      expect(result.socialLinks.linkedin[0]).toContain('linkedin.com/company/acme');
      expect(result.socialLinks.facebook).toHaveLength(1);
      expect(result.socialLinks.facebook[0]).toContain('facebook.com/acme');
      expect(result.socialLinks.instagram).toHaveLength(1);
      expect(result.socialLinks.instagram[0]).toContain('instagram.com/acme');
    });

    it('handles empty HTML gracefully', () => {
      const result = scrapePage('', 'https://example.com');
      expect(result.pageTitle).toBe('');
      expect(result.description).toBe('');
      expect(result.emails).toHaveLength(0);
      expect(result.phones).toHaveLength(0);
    });

    it('resolves relative URLs for social detection', () => {
      const html = '<a href="/about">About</a><a href="//linkedin.com/company/test">LI</a>';
      const result = scrapePage(html, 'https://example.com');
      expect(result.socialLinks.linkedin).toHaveLength(1);
      expect(result.socialLinks.linkedin[0]).toContain('linkedin.com/company/test');
    });

    it('validates email format in mailto links', () => {
      const html = '<a href="mailto:notanemail">Bad</a><a href="mailto:valid@example.com">Good</a>';
      const result = scrapePage(html, 'https://example.com');
      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].email).toBe('valid@example.com');
    });

    it('excludes query params from tel links', () => {
      const html = '<a href="tel:+1234567890?callerid=test">Call</a>';
      const result = scrapePage(html, 'https://example.com');
      expect(result.phones).toHaveLength(1);
      expect(result.phones[0].phone).toBe('+1234567890');
    });

    it('detects multiple social links of the same type', () => {
      const html = `<a href="https://linkedin.com/company/acme">LI1</a>
        <a href="https://linkedin.com/in/johndoe">LI2</a>`;
      const result = scrapePage(html, 'https://example.com');
      expect(result.socialLinks.linkedin).toHaveLength(2);
    });
  });
});
