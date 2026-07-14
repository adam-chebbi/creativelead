export interface ScrapedContacts {
  emails: { email: string; source: 'mailto' | 'text'; context?: string }[];
  phones: { phone: string; source: 'tel' | 'text'; context?: string }[];
  socialLinks: {
    linkedin: string[];
    facebook: string[];
    instagram: string[];
    tiktok: string[];
    youtube: string[];
  };
  pageTitle: string;
  description: string;
  rawText: string;
}

function normalizeUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).href; } catch { return ''; }
}

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  linkedin: /linkedin\.com\/(company|in|school)\/[a-z0-9_-]+/i,
  facebook: /facebook\.com\/([a-z0-9._-]+)/i,
  instagram: /instagram\.com\/([a-z0-9._-]+)/i,
  tiktok: /tiktok\.com\/@?([a-z0-9._-]+)/i,
  youtube: /youtube\.com\/(c|channel|user|@[a-z0-9_-]+)/i,
};

function detectSocial(url: string): { platform: string; profile: string } | null {
  for (const [platform, pattern] of Object.entries(SOCIAL_PATTERNS)) {
    const m = url.match(pattern);
    if (m) return { platform, profile: m[0] };
  }
  return null;
}

export async function scrapeWebsiteContacts(websiteUrl: string): Promise<ScrapedContacts> {
  const result: ScrapedContacts = {
    emails: [], phones: [],
    socialLinks: { linkedin: [], facebook: [], instagram: [], tiktok: [], youtube: [] },
    pageTitle: '', description: '', rawText: '',
  };

  const url = extractUrl(websiteUrl);
  if (!url) return result;

  let html: string;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    clearTimeout(timeout);
    if (!resp.ok) return result;
    html = await resp.text();
  } catch {
    return result;
  }

  result.rawText = html;

  const titleM = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleM) result.pageTitle = titleM[1].trim();

  const descM = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (descM) result.description = descM[1].trim();

  const links: string[] = [];
  const anchorRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let am: RegExpExecArray | null;
  while ((am = anchorRegex.exec(html)) !== null) {
    links.push(am[1]);
  }

  for (const rawHref of links) {
    const href = rawHref.trim();

    // mailto:
    if (href.startsWith('mailto:')) {
      const email = href.replace(/^mailto:/i, '').split('?')[0].trim();
      if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        result.emails.push({ email, source: 'mailto' });
      }
      continue;
    }

    // tel:
    if (href.startsWith('tel:')) {
      const phone = href.replace(/^tel:/i, '').split(/[;?]/)[0].trim();
      if (phone) result.phones.push({ phone, source: 'tel' });
      continue;
    }

    // social detection
    try {
      const absolute = new URL(href, url).href;
      const social = detectSocial(absolute);
      if (social) {
        const platform = social.platform as keyof ScrapedContacts['socialLinks'];
        result.socialLinks[platform].push(absolute);
      }
    } catch {
      // relative URL that couldn't be resolved
    }
  }

  // Deduplicate
  result.emails = dedup(result.emails, e => e.email);
  result.phones = dedup(result.phones, p => p.phone);
  for (const key of Object.keys(result.socialLinks) as (keyof ScrapedContacts['socialLinks'])[]) {
    result.socialLinks[key] = [...new Set(result.socialLinks[key])];
  }

  return result;
}

function extractUrl(input: string): string | null {
  let u = input.trim();
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try { return new URL(u).href; } catch { return null; }
}

function dedup<T>(arr: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}