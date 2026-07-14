import { prisma } from '@/lib/prisma';
import { scoreLeadById } from './score-lead-server';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

interface CacheEntry {
  fetchedAt: number;
  html: string;
  headers: Record<string, string>;
  statusCode: number;
}

const cache = new Map<string, CacheEntry>();

function getCacheKey(url: string): string {
  return url.replace(/\/+$/, '').toLowerCase();
}

function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
}

async function fetchWithTimeout(url: string, signal: AbortSignal): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  signal.addEventListener('abort', () => {
    clearTimeout(timeout);
    controller.abort();
  });

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CreativeLeadBot/1.0 (website-intelligence; +https://creativelead.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRobotsTxt(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`https://${domain}/robots.txt`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'CreativeLeadBot/1.0' },
    });
    clearTimeout(timeout);

    if (!resp.ok) return true;

    const text = await resp.text();
    const lines = text.split('\n');

    let inRelevantSection = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toLowerCase().startsWith('user-agent:')) {
        const agent = line.split(':').slice(1).join(':').trim().toLowerCase();
        inRelevantSection = agent === '*' || agent === 'creativeleadbot';
        continue;
      }
      if (inRelevantSection) {
        if (line.startsWith('User-agent')) break;
        if (line.toLowerCase().startsWith('disallow:')) {
          const path = line.split(':').slice(1).join(':').trim();
          if (path === '/' || path === '/*') return false;
        }
      }
    }
    return true;
  } catch {
    return true;
  }
}

interface FetchedPage {
  html: string;
  headers: Record<string, string>;
  statusCode: number;
  loadTimeMs: number;
  error: string | null;
}

async function fetchPage(url: string, forceRefresh = false): Promise<FetchedPage> {
  const cacheKey = getCacheKey(url);

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached && isCacheValid(cached)) {
      return {
        html: cached.html,
        headers: cached.headers,
        statusCode: cached.statusCode,
        loadTimeMs: 0,
        error: null,
      };
    }
  }

  const normalized = url.startsWith('http') ? url : `https://${url}`;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return { html: '', headers: {}, statusCode: 0, loadTimeMs: 0, error: 'Invalid URL' };
  }

  const allowed = await checkRobotsTxt(parsedUrl.hostname);
  if (!allowed) {
    return { html: '', headers: {}, statusCode: 0, loadTimeMs: 0, error: 'Blocked by robots.txt' };
  }

  let lastError: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const aborter = new AbortController();
    const startTime = Date.now();

    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }

      const resp = await fetchWithTimeout(normalized, aborter.signal);
      const loadTimeMs = Date.now() - startTime;

      if (!resp.ok) {
        lastError = `HTTP ${resp.status} ${resp.statusText}`;
        if (resp.status >= 400 && resp.status < 500) break;
        continue;
      }

      const html = await resp.text();
      const headers: Record<string, string> = {};
      resp.headers.forEach((val, key) => { headers[key.toLowerCase()] = val; });

      cache.set(cacheKey, {
        fetchedAt: Date.now(),
        html,
        headers,
        statusCode: resp.status,
      });

      return { html, headers, statusCode: resp.status, loadTimeMs, error: null };
    } catch (err) {
      if (aborter.signal.aborted) {
        lastError = 'Timeout after 15s';
      } else {
        lastError = err instanceof Error ? err.message : 'Unknown fetch error';
      }
    }
  }

  return { html: '', headers: {}, statusCode: 0, loadTimeMs: 0, error: lastError };
}

// ── Detection Patterns ──────────────────────────────────────────

type TechCategory = 'cms' | 'framework' | 'analytics' | 'chatbot' | 'hosting' | 'other';

interface DetectedTechnology {
  name: string;
  category: TechCategory;
  confidence: 'high' | 'medium' | 'low';
  signal: string;
}

interface SeoResult {
  hasTitle: boolean;
  titleContent: string | null;
  hasMetaDescription: boolean;
  metaDescriptionContent: string | null;
  hasH1: boolean;
  hasMultipleH1: boolean;
  headingStructure: { h1: number; h2: number; h3: number };
  hasImageAlt: boolean;
  missingAltCount: number;
  hasCanonical: boolean;
  canonicalUrl: string | null;
  robotsTxtAccessible: boolean;
  sitemapXmlAccessible: boolean;
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  score: number;
}

interface PerformanceResult {
  loadTimeMs: number;
  pageSizeBytes: number;
  pageSizeFormatted: string;
  coreWebVitals: {
    lcp?: number;
    fcp?: number;
    tti?: number;
    source: 'measured' | 'estimated' | 'unavailable';
  };
  score: number;
}

interface WebsiteAnalysis {
  url: string;
  reachable: boolean;
  error: string | null;
  statusCode: number | null;
  isHttps: boolean;
  hasValidSsl: boolean;
  sslDetails: string | null;
  hasViewportMeta: boolean;
  technologies: DetectedTechnology[];
  seo: SeoResult;
  performance: PerformanceResult;
  hasAnalytics: boolean;
  analyticsFound: string[];
  hasChatbot: boolean;
  chatbotFound: string[];
  improvementOpportunities: string[];
  analyzedAt: string;
}

const ANALYTICS_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Google Analytics (GA4 / gtag)', pattern: /(gtag\(|googletagmanager\.com\/gtag\/js|_ga\s*=|G-[A-Z0-9]+)/i },
  { name: 'Google Analytics (Universal)', pattern: /google-analytics\.com\/analytics\.js|ga\(/i },
  { name: 'Google Tag Manager', pattern: /googletagmanager\.com\/gtm\.js|dataLayer\s*=\s*dataLayer/i },
  { name: 'Meta Pixel (Facebook)', pattern: /connect\.facebook\.net\/[^/]+\/fbevents\.js|fbq\(/i },
  { name: 'LinkedIn Insight', pattern: /snap\.licdn\.com\/li\.(lms|track)/i },
  { name: 'Twitter / X Pixel', pattern: /static\.ads-twitter\.com\/uwt\.js|twq\(/i },
  { name: 'Hotjar', pattern: /static\.hotjar\.com\/c\/hotjar-|hj\.hjSettings/i },
  { name: 'HubSpot Analytics', pattern: /js\.hs-scripts\.com\/[^/]+\.js|hs-analytics/i },
  { name: 'Intercom', pattern: /widget\.intercom\.io\/widget/i },
  { name: 'Mixpanel', pattern: /cdn\.mxpnl\.com\/libs|mixpanel\.init/i },
  { name: 'Pinterest Tag', pattern: /ct\.pinterest\.com\/ct\.js|pinIt\s*=/i },
  { name: 'Reddit Pixel', pattern: /alb\.reddit\.com\/pixel\.js|rdt\.('track'|'init')/i },
  { name: 'TikTok Pixel', pattern: /ads\.tiktok\.com\/i18n\/pixel|ttq\.('track'|'page')/i },
  { name: 'Bing Ads (UET)', pattern: /bat\.bing\.com\/bat\.js|uetq\s*=/i },
  { name: 'Crazy Egg', pattern: /script\.crazyegg\.com\/pages\/scripts/i },
  { name: 'FullStory', pattern: /fullstory\.com\/s\/fs|window\[['"]_fs_['"]\]/i },
  { name: 'Segment', pattern: /cdn\.segment\.com\/analytics\.js|analytics\.(load|page|track)/i },
];

const CHATBOT_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Intercom', pattern: /intercom\.io\/widget|window\.Intercom/i },
  { name: 'Drift', pattern: /drift\.com\/driftbot|drift\.load|window\.drift/i },
  { name: 'HubSpot Chat', pattern: /hs-scripts\.com\/[0-9]+\.js|ConversationsAPI|window\.HubSpotConversations/i },
  { name: 'Tidio', pattern: /tidio\.chat|document\.write\(['"]<div id=['"]tidio-chat/i },
  { name: 'Tawk.to', pattern: /tawk\.to\/[a-z0-9]+\/[a-z0-9]+|Tawk_API|Tawk_LoadStart/i },
  { name: 'LiveChat', pattern: /cdn\.livechatinc\.com\/tracking\.js|__lc_|livechat_license/i },
  { name: 'Crisp', pattern: /crisp\.chat\/crisp\.js|window\.\$crisp/i },
  { name: 'Zendesk Chat', pattern: /zendesk\.com\/embeddable\/embeddable\.js|window\.zE/i },
  { name: 'Olark', pattern: /static\.olark\.com\/jsclient\/loader|olark\.identify/i },
  { name: 'LivePerson', pattern: /lpserver\.liveperson\.net|LP\(['"]/i },
  { name: 'ManyChat', pattern: /manychat\.com\/js\/|manychat_/i },
  { name: 'Chatra', pattern: /chatra\.com\/js\/chatra|window\.Chatra/i },
  { name: 'Freshchat / Freshworks', pattern: /freshchat\.com\/js\/wc\.js|initFreshchat|fcWidget\.init/i },
  { name: 'WhatsApp Widget', pattern: /wa\.me\/|wa\.link\/|api\.whatsapp\.com\/send/i },
  { name: 'Messenger (FB)', pattern: /connect\.facebook\.net\/[^/]+\/sdk\/xfbml\.customerchat/i },
  { name: 'Gorgias', pattern: /gorgias\.chat|GorgiasChat|gorgias\.io\/js/i },
];

const CMS_PATTERNS: { name: string; category: TechCategory; pattern: RegExp; confidence: 'high' | 'medium' | 'low' }[] = [
  { name: 'WordPress', category: 'cms', pattern: /<meta\s+name=["']generator["'][^>]*content=["']WordPress\s+([^"']+)["']/i, confidence: 'high' },
  { name: 'WordPress', category: 'cms', pattern: /\/wp-content\/(themes|plugins)\//, confidence: 'medium' },
  { name: 'WordPress', category: 'cms', pattern: /\/wp-includes\//, confidence: 'medium' },
  { name: 'Shopify', category: 'cms', pattern: /<meta\s+name=["']generator["'][^>]*content=["']Shopify["']/i, confidence: 'high' },
  { name: 'Shopify', category: 'cms', pattern: /cdn\.shopify\.com/, confidence: 'medium' },
  { name: 'Shopify', category: 'cms', pattern: /\.myshopify\.com/, confidence: 'high' },
  { name: 'Wix', category: 'cms', pattern: /<meta\s+name=["']generator["'][^>]*content=["']Wix/i, confidence: 'high' },
  { name: 'Wix', category: 'cms', pattern: /static\.wixstatic\.com/, confidence: 'medium' },
  { name: 'Squarespace', category: 'cms', pattern: /<meta\s+name=["']generator["'][^>]*content=["']Squarespace/i, confidence: 'high' },
  { name: 'Squarespace', category: 'cms', pattern: /static[0-9]\.squarespace\.com/, confidence: 'medium' },
  { name: 'Webflow', category: 'cms', pattern: /<meta\s+name=["']generator["'][^>]*content=["']Webflow/i, confidence: 'high' },
  { name: 'Drupal', category: 'cms', pattern: /<meta\s+name=["']generator["'][^>]*content=["']Drupal/i, confidence: 'high' },
  { name: 'Drupal', category: 'cms', pattern: /\/sites\/default\/files\//, confidence: 'medium' },
  { name: 'Joomla', category: 'cms', pattern: /<meta\s+name=["']generator["'][^>]*content=["']Joomla/i, confidence: 'high' },
  { name: 'Next.js', category: 'framework', pattern: /__NEXT_DATA__|__next|_next\/static/, confidence: 'high' },
  { name: 'Gatsby', category: 'framework', pattern: /<meta\s+name=["']generator["'][^>]*content=["']Gatsby/i, confidence: 'high' },
  { name: 'Nuxt.js', category: 'framework', pattern: /__NUXT__/, confidence: 'high' },
  { name: 'Laravel', category: 'framework', pattern: /laravel_session|XSRF-TOKEN|csfr_token|livewire/i, confidence: 'medium' },
  { name: 'Laravel', category: 'framework', pattern: /<meta\s+name=["']csrf-token["']/i, confidence: 'medium' },
  { name: 'React', category: 'framework', pattern: /react\.(min\.)?js|React\.createElement|react-dom|_React["']/i, confidence: 'medium' },
  { name: 'Angular', category: 'framework', pattern: /ng-version|angular\.js|zone\.js|ng-app/i, confidence: 'high' },
  { name: 'Vue.js', category: 'framework', pattern: /vue\.(min\.)?js|__VUE__|Vue\.config|v-bind|v-model/i, confidence: 'high' },
  { name: 'Svelte', category: 'framework', pattern: /__svelte|svelte-[0-9a-f]+/i, confidence: 'medium' },
  { name: 'Bootstrap', category: 'framework', pattern: /bootstrap(\.min)?\.css|bootstrap(\.min)?\.js|data-bs-/i, confidence: 'medium' },
  { name: 'Tailwind CSS', category: 'framework', pattern: /tailwindcss|\.tw-/i, confidence: 'medium' },
];

const HOSTING_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: 'Cloudflare', pattern: /cf-ray|__cfduid|cf-cache-status|cloudflare-nginx/i },
  { name: 'AWS (CloudFront)', pattern: /cloudfront\.net|x-amz-cf-id|x-amz-cf-pop/i },
  { name: 'Netlify', pattern: /netlify\.com|x-nf-request-id/i },
  { name: 'Vercel', pattern: /vercel\.com|x-vercel-id/i },
  { name: 'GitHub Pages', pattern: /github\.io|GitHub\.com/i },
  { name: 'Google Cloud', pattern: /google\.com|gstatic\.com/i },
  { name: 'Azure', pattern: /azureedge\.net|azure\.com|x-msedge-/i },
  { name: 'Fastly', pattern: /X-Served-By.*fastly|x-timer-served.*fastly/i },
  { name: 'Akamai', pattern: /akamai|akamaiedge/i },
];

// ── Analysis Functions ──────────────────────────────────────────

function detectTechnologies(html: string, headers: Record<string, string>, url: string): DetectedTechnology[] {
  const detected: DetectedTechnology[] = [];
  const added = new Set<string>();

  for (const rule of CMS_PATTERNS) {
    if (rule.pattern.test(html) && !added.has(rule.name + rule.category)) {
      added.add(rule.name + rule.category);
      detected.push({ name: rule.name, category: rule.category, confidence: rule.confidence, signal: `matched ${rule.pattern.source.slice(0, 60)}` });
    }
  }

  const headerKeys = Object.keys(headers);
  const combinedCheck = html + ' ' + headerKeys.join(' ');
  for (const rule of HOSTING_PATTERNS) {
    if (rule.pattern.test(combinedCheck) && !added.has('hosting_' + rule.name)) {
      added.add('hosting_' + rule.name);
      detected.push({ name: rule.name, category: 'hosting', confidence: 'medium', signal: `header/content match for ${rule.name}` });
    }
  }

  for (const rule of ANALYTICS_PATTERNS) {
    if (rule.pattern.test(html) && !added.has('analytics_' + rule.name)) {
      added.add('analytics_' + rule.name);
      detected.push({ name: rule.name, category: 'analytics', confidence: 'high', signal: 'found analytics snippet in page' });
    }
  }

  for (const rule of CHATBOT_PATTERNS) {
    if (rule.pattern.test(html) && !added.has('chatbot_' + rule.name)) {
      added.add('chatbot_' + rule.name);
      detected.push({ name: rule.name, category: 'chatbot', confidence: 'high', signal: 'found chat widget script' });
    }
  }

  const cmsFromHeader = detectCmsFromHeaders(headers);
  if (cmsFromHeader && !added.has('header_' + cmsFromHeader)) {
    added.add('header_' + cmsFromHeader);
    detected.push({ name: cmsFromHeader, category: 'cms', confidence: 'high', signal: `Server header indicates ${cmsFromHeader}` });
  }

  if (detected.length === 0) {
    detected.push({ name: 'Unknown/Custom', category: 'other', confidence: 'low', signal: 'No platform-specific markers found' });
  }

  return detected;
}

function detectCmsFromHeaders(headers: Record<string, string>): string | null {
  const poweredBy = headers['x-powered-by'] || '';
  const server = headers['server'] || '';

  if (poweredBy.includes('Express')) return 'Express';
  if (poweredBy.includes('Next.js')) return 'Next.js';
  if (poweredBy.includes('ASP.NET')) return 'ASP.NET';
  if (server.includes('cloudflare') && poweredBy.includes('PHP')) return 'WordPress (Cloudflare)';
  if (server.includes('nginx') && poweredBy.includes('PHP')) return 'WordPress (nginx)';
  if (server.includes('Apache') && poweredBy.includes('PHP')) return 'WordPress (Apache)';

  return null;
}

function detectAnalytics(html: string): string[] {
  const found: string[] = [];
  for (const rule of ANALYTICS_PATTERNS) {
    if (rule.pattern.test(html)) found.push(rule.name);
  }
  return found;
}

function detectChatbots(html: string): string[] {
  const found: string[] = [];
  for (const rule of CHATBOT_PATTERNS) {
    if (rule.pattern.test(html)) found.push(rule.name);
  }
  return found;
}

function performSeoAudit(html: string, url: string): SeoResult {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const hasTitle = !!(titleMatch && titleMatch[1].trim().length > 0);
  const titleContent = titleMatch ? titleMatch[1].trim() : null;

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  const hasMetaDescription = !!(descMatch && descMatch[1].trim().length > 0);
  const metaDescriptionContent = descMatch ? descMatch[1].trim() : null;

  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
  const hasH1 = h1Count > 0;
  const hasMultipleH1 = h1Count > 1;

  const totalImgTags = (html.match(/<img[^>]*>/gi) || []).length;
  const altImgTags = (html.match(/<img[^>]*alt=["'][^"']*["'][^>]*>/gi) || []).length;
  const ariaImgTags = (html.match(/<img[^>]*alt\s*=\s*["']{2}[^>]*>/gi) || []).length;
  const meaningfulAlt = altImgTags - ariaImgTags;
  const missingAltCount = totalImgTags - meaningfulAlt;
  const hasImageAlt = totalImgTags === 0 || missingAltCount < totalImgTags * 0.3;

  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const hasCanonical = !!canonicalMatch;
  const canonicalUrl = canonicalMatch ? canonicalMatch[1] : null;

  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
  let hasStructuredData = false;
  const structuredDataTypes: string[] = [];
  if (jsonLdBlocks) {
    hasStructuredData = true;
    for (const block of jsonLdBlocks) {
      const typeMatch = block.match(/"@type"\s*:\s*"([^"]+)"/);
      if (typeMatch) structuredDataTypes.push(typeMatch[1]);
    }
  }
  if (!hasStructuredData) {
    const itemscopes = html.match(/itemscope|itemtype=["']http:\/\/schema\.org\//gi);
    if (itemscopes && itemscopes.length > 0) hasStructuredData = true;
  }

  let score = 0;
  if (hasTitle && (titleContent?.length ?? 0) >= 10) score += 20;
  if (hasMetaDescription && (metaDescriptionContent?.length ?? 0) >= 50) score += 15;
  if (hasH1 && !hasMultipleH1) score += 15;
  if (hasImageAlt) score += 10;
  if (hasCanonical) score += 10;
  if (hasStructuredData) score += 15;
  if (h2Count > 0) score += 10;
  if (h3Count > 0) score += 5;

  return {
    hasTitle, titleContent, hasMetaDescription, metaDescriptionContent,
    hasH1, hasMultipleH1, headingStructure: { h1: h1Count, h2: h2Count, h3: h3Count },
    hasImageAlt, missingAltCount, hasCanonical, canonicalUrl,
    robotsTxtAccessible: false, sitemapXmlAccessible: false,
    hasStructuredData, structuredDataTypes, score,
  };
}

function measurePerformance(loadTimeMs: number, html: string): PerformanceResult {
  const pageSizeBytes = new TextEncoder().encode(html).length;
  const pageSizeFormatted = formatBytes(pageSizeBytes);

  let perfScore = 50;
  if (loadTimeMs < 500) perfScore += 25;
  else if (loadTimeMs < 1500) perfScore += 15;
  else if (loadTimeMs > 5000) perfScore -= 15;
  else if (loadTimeMs > 3000) perfScore -= 5;

  if (pageSizeBytes < 100000) perfScore += 15;
  else if (pageSizeBytes < 500000) perfScore += 5;
  else if (pageSizeBytes > 2000000) perfScore -= 15;
  else if (pageSizeBytes > 1000000) perfScore -= 5;

  perfScore = Math.max(0, Math.min(100, Math.round(perfScore)));

  return {
    loadTimeMs,
    pageSizeBytes,
    pageSizeFormatted,
    coreWebVitals: {
      source: 'estimated',
      lcp: Math.round(loadTimeMs * 1.2),
      fcp: Math.round(loadTimeMs * 0.6),
      tti: Math.round(loadTimeMs * 1.5),
    },
    score: perfScore,
  };
}

function analyzeHtml(html: string, headers: Record<string, string>, url: string, loadTimeMs: number): WebsiteAnalysis {
  const isHttps = url.startsWith('https://');
  const hasViewportMeta = /<meta\s+[^>]*name=["']viewport["']/i.test(html);
  const technologies = detectTechnologies(html, headers, url);
  const analyticsFound = detectAnalytics(html);
  const chatbotFound = detectChatbots(html);
  const seo = performSeoAudit(html, url);
  const performance = measurePerformance(loadTimeMs, html);
  const hasAnalytics = analyticsFound.length > 0;
  const hasChatbot = chatbotFound.length > 0;
  const pageSizeBytes = new TextEncoder().encode(html).length;

  const improvements: string[] = [];
  if (!isHttps) improvements.push('No SSL — migrate to HTTPS immediately');
  if (!hasViewportMeta) improvements.push('Missing viewport meta tag — not mobile-responsive');
  if (!seo.hasTitle) improvements.push('Missing <title> tag');
  if (seo.titleContent && seo.titleContent.length < 10) improvements.push(`Short <title> (${seo.titleContent.length} chars)`);
  if (!seo.hasMetaDescription) improvements.push('Missing meta description');
  if (!seo.hasH1) improvements.push('Missing H1 heading');
  if (seo.hasMultipleH1) improvements.push(`${seo.headingStructure.h1} H1 tags — should have exactly one`);
  if (!seo.hasCanonical) improvements.push('Missing canonical tag');
  if (seo.missingAltCount > 0) improvements.push(`${seo.missingAltCount} images missing alt text`);
  if (!seo.hasStructuredData) improvements.push('No structured data (JSON-LD)');
  if (!hasAnalytics) improvements.push('No analytics detected');
  if (!hasChatbot) improvements.push('No live chat widget');
  if (loadTimeMs > 3000) improvements.push(`Slow load time (${loadTimeMs}ms)`);
  if (pageSizeBytes > 1000000) improvements.push(`Large page size (${formatBytes(pageSizeBytes)})`);

  return {
    url,
    reachable: true,
    error: null,
    statusCode: null,
    isHttps,
    hasValidSsl: isHttps,
    sslDetails: isHttps ? 'HTTPS — valid certificate' : 'No TLS',
    hasViewportMeta,
    technologies,
    seo,
    performance,
    hasAnalytics,
    analyticsFound,
    hasChatbot,
    chatbotFound,
    improvementOpportunities: improvements,
    analyzedAt: new Date().toISOString(),
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}

// ── Public API ───────────────────────────────────────────────────

export async function analyzeWebsiteServer(
  leadId: string,
  orgId: string,
  forceRefresh = false,
): Promise<{ ok: boolean; error?: string }> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
  });

  if (!lead) return { ok: false, error: 'Lead not found' };
  if (!lead.website) return { ok: false, error: 'Lead has no website URL' };

  const fetched = await fetchPage(lead.website, forceRefresh);

  let result: WebsiteAnalysis;

  if (fetched.error || !fetched.html) {
    result = {
      url: lead.website,
      reachable: false,
      error: fetched.error || 'Website unreachable',
      statusCode: fetched.statusCode || null,
      isHttps: lead.website.startsWith('https://'),
      hasValidSsl: false,
      sslDetails: null,
      hasViewportMeta: false,
      technologies: [],
      seo: emptySeo(),
      performance: emptyPerf(),
      hasAnalytics: false,
      analyticsFound: [],
      hasChatbot: false,
      chatbotFound: [],
      improvementOpportunities: ['Website unreachable — cannot assess'],
      analyzedAt: new Date().toISOString(),
    };
  } else {
    result = analyzeHtml(fetched.html, fetched.headers, lead.website, fetched.loadTimeMs);
  }

  await prisma.leadWebsiteIntelligence.upsert({
    where: { leadId },
    create: {
      leadId,
      reachable: result.reachable,
      isHttps: result.isHttps,
      hasViewportMeta: result.hasViewportMeta,
      seoScore: result.seo.score,
      performanceScore: result.performance.score,
      loadTimeMs: result.performance.loadTimeMs,
      hasAnalytics: result.hasAnalytics,
      analyticsTools: result.analyticsFound,
      hasChatbot: result.hasChatbot,
      chatbotTools: result.chatbotFound,
      detectedTechnologies: result.technologies,
      hasTitle: result.seo.hasTitle,
      hasMetaDescription: result.seo.hasMetaDescription,
      hasStructuredData: result.seo.hasStructuredData,
      missingAltCount: result.seo.missingAltCount,
      totalImgTags: result.seo.headingStructure.h1 + result.seo.headingStructure.h2 + result.seo.headingStructure.h3,
      lastCheckedAt: new Date(),
    },
    update: {
      reachable: result.reachable,
      isHttps: result.isHttps,
      hasViewportMeta: result.hasViewportMeta,
      seoScore: result.seo.score,
      performanceScore: result.performance.score,
      loadTimeMs: result.performance.loadTimeMs,
      hasAnalytics: result.hasAnalytics,
      analyticsTools: result.analyticsFound,
      hasChatbot: result.hasChatbot,
      chatbotTools: result.chatbotFound,
      detectedTechnologies: result.technologies,
      hasTitle: result.seo.hasTitle,
      hasMetaDescription: result.seo.hasMetaDescription,
      hasStructuredData: result.seo.hasStructuredData,
      missingAltCount: result.seo.missingAltCount,
      totalImgTags: result.seo.headingStructure.h1 + result.seo.headingStructure.h2 + result.seo.headingStructure.h3,
      lastCheckedAt: new Date(),
    },
  });

  try {
    await scoreLeadById(leadId, orgId);
  } catch (err) {
    console.error(`[website-intel] rescore failed for ${leadId}:`, err);
  }

  return { ok: true };
}

export async function queueWebsiteIntel(leadId: string, orgId: string): Promise<void> {
  try {
    await analyzeWebsiteServer(leadId, orgId);
  } catch (err) {
    console.error(`[website-intel] queued analysis failed for ${leadId}:`, err);
  }
}

function emptySeo(): SeoResult {
  return {
    hasTitle: false, titleContent: null, hasMetaDescription: false, metaDescriptionContent: null,
    hasH1: false, hasMultipleH1: false, headingStructure: { h1: 0, h2: 0, h3: 0 },
    hasImageAlt: false, missingAltCount: 0, hasCanonical: false, canonicalUrl: null,
    robotsTxtAccessible: false, sitemapXmlAccessible: false,
    hasStructuredData: false, structuredDataTypes: [],
    score: 0,
  };
}

function emptyPerf(): PerformanceResult {
  return {
    loadTimeMs: 0, pageSizeBytes: 0, pageSizeFormatted: '0 B',
    coreWebVitals: { lcp: undefined, fcp: undefined, tti: undefined, source: 'unavailable' },
    score: 0,
  };
}
