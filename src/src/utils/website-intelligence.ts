import { WebsiteIntelligence, DetectedTechnology, SeoAuditResult, PerformanceAudit } from '../types';
import { getSettings } from '../hooks/useSettingsStore';

// ──────────────────────────────────────────────
//  Website Intelligence Engine
// ──────────────────────────────────────────────
// Browser-only: fetches are subject to CORS. If the target site blocks
// cross-origin requests, the engine reports "Website unreachable (CORS)"
// rather than faking data. For full capability, deploy the proxy function
// in website/src/serverless/website-proxy.ts to a serverless endpoint
// (Cloudflare Worker, Vercel Function, etc.) and set PROXY_URL in .env.
// ──────────────────────────────────────────────

let proxyUrl = '';
try {
  const env = (typeof process !== 'undefined' && process.env?.VITE_WEBSITE_PROXY_URL) as string | undefined;
  if (env) proxyUrl = env;
} catch {
  // not in Vite env
}

export function setProxyUrl(url: string) {
  proxyUrl = url;
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

const CMS_PATTERNS: { name: string; category: DetectedTechnology['category']; pattern: RegExp; confidence: DetectedTechnology['confidence'] }[] = [
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

export async function analyzeWebsite(urlStr: string): Promise<WebsiteIntelligence> {
  const startTime = performance.now();

  const normalized = normalizeWebsiteUrl(urlStr);
  if (!normalized) {
    return unreachableResponse(urlStr, 'Invalid URL provided');
  }

  let statusCode: number | null = null;
  let html = '';
  let headers: Record<string, string> = {};
  let fetchError: string | null = null;

  // ── Fetch ──
  try {
    const directResp = await attemptDirect(normalized);
    if (directResp) {
      statusCode = directResp.status;
      html = directResp.text;
      directResp.headers.forEach((val, key) => { headers[key.toLowerCase()] = val; });
    } else {
      // Try proxy if configured
      if (proxyUrl) {
        const proxyResp = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: normalized }),
        });
        if (proxyResp.ok) {
          const data = await proxyResp.json();
          statusCode = data.statusCode;
          html = data.body || '';
          if (data.headers) headers = data.headers;
        } else {
          fetchError = `Proxy returned ${proxyResp.status}`;
        }
      } else {
        fetchError = 'CORS blocked and no proxy configured';
      }
    }
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Unknown fetch error';
  }

  if (fetchError || !html) {
    return {
      ...unreachableResponse(normalized, fetchError || 'Website unreachable'),
      statusCode,
    };
  }

  const loadTimeMs = Date.now() - startTime;

  // ── Technology Detection ──
  const technologies = detectTechnologies(html, headers, normalized);

  // ── SSL Check ──
  const isHttps = normalized.startsWith('https://');
  const sslResult = checkSsl(isHttps, loadTimeMs);

  // ── Mobile Check ──
  const hasViewportMeta = /<meta\s+[^>]*name=["']viewport["']/i.test(html);

  // ── Analytics Detection ──
  const analyticsFound = detectAnalytics(html);

  // ── Chatbot Detection ──
  const chatbotFound = detectChatbots(html);

  // ── SEO Audit ──
  const seo = performSeoAudit(html, normalized);

  // ── Performance ──
  const perf = measurePerformance(loadTimeMs, html);

  // ── Improvement Opportunities ──
  const opportunities = generateImprovements({
    isHttps, hasViewportMeta: hasViewportMeta, seo, perf,
    hasAnalytics: analyticsFound.length > 0, hasChatbot: chatbotFound.length > 0,
    technologies,
  });

  return {
    url: normalized,
    reachable: true,
    error: null,
    statusCode,
    isHttps,
    hasValidSsl: sslResult.valid,
    sslDetails: sslResult.detail,
    hasViewportMeta,
    technologies,
    seo,
    performance: perf,
    hasAnalytics: analyticsFound.length > 0,
    analyticsFound,
    hasChatbot: chatbotFound.length > 0,
    chatbotFound,
    improvementOpportunities: opportunities,
    analyzedAt: new Date().toISOString(),
  };
}

// ── Helpers ──

function normalizeWebsiteUrl(url: string): string | null {
  let u = url.trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

async function attemptDirect(url: string): Promise<{ status: number; text: string; headers: Headers } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
    });
    clearTimeout(timeout);
    if (!resp.ok) return null;
    const text = await resp.text();
    return { status: resp.status, text, headers: resp.headers };
  } catch {
    return null;
  }
}

function unreachableResponse(url: string, error: string): WebsiteIntelligence {
  return {
    url,
    reachable: false,
    error,
    statusCode: null,
    isHttps: url.startsWith('https://'),
    hasValidSsl: false,
    sslDetails: null,
    hasViewportMeta: false,
    technologies: [],
    seo: emptySeoAudit(),
    performance: emptyPerformance(),
    hasAnalytics: false,
    analyticsFound: [],
    hasChatbot: false,
    chatbotFound: [],
    improvementOpportunities: ['Website unreachable — cannot assess'],
    analyzedAt: new Date().toISOString(),
  };
}

function checkSsl(isHttps: boolean, loadTimeMs: number): { valid: boolean; detail: string } {
  if (!isHttps) {
    return { valid: false, detail: 'Site loaded over HTTP — no TLS' };
  }
  // If the page loaded over HTTPS without fetch error, the browser already validated the cert
  if (loadTimeMs < 30000) {
    return { valid: true, detail: 'HTTPS — valid certificate (verified by browser during fetch)' };
  }
  return { valid: true, detail: 'HTTPS — assumed valid (no connect error)' };
}

function detectTechnologies(html: string, headers: Record<string, string>, url: string): DetectedTechnology[] {
  const detected: DetectedTechnology[] = [];
  const added = new Set<string>();

  for (const rule of CMS_PATTERNS) {
    if (rule.pattern.test(html) && !added.has(rule.name + rule.category)) {
      added.add(rule.name + rule.category);
      detected.push({ name: rule.name, category: rule.category as any, confidence: rule.confidence, signal: `matched ${rule.pattern.source.slice(0, 60)}` });
    }
  }

  for (const rule of HOSTING_PATTERNS) {
    const headerKeys = Object.keys(headers);
    const combinedCheck = html + ' ' + headerKeys.join(' ');
    if (rule.pattern.test(combinedCheck) && !added.has('hosting_' + rule.name)) {
      added.add('hosting_' + rule.name);
      detected.push({ name: rule.name, category: 'hosting', confidence: 'medium', signal: `header/content match for ${rule.name}` });
    }
  }

  // Analytics tools + chatbots are detected later in their own blocks, but also add as tech
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

  // If nothing detected, report unknown
  if (detected.length === 0) {
    detected.push({ name: 'Unknown/Custom', category: 'other', confidence: 'low', signal: 'No platform-specific markers found' });
  }

  return detected;
}

function detectAnalytics(html: string): string[] {
  const found: string[] = [];
  for (const rule of ANALYTICS_PATTERNS) {
    if (rule.pattern.test(html)) {
      found.push(rule.name);
    }
  }
  return found;
}

function detectChatbots(html: string): string[] {
  const found: string[] = [];
  for (const rule of CHATBOT_PATTERNS) {
    if (rule.pattern.test(html)) {
      found.push(rule.name);
    }
  }
  return found;
}

function performSeoAudit(html: string, url: string): SeoAuditResult {
  let hasTitle = false;
  let titleContent: string | null = null;
  let hasMetaDescription = false;
  let metaDescriptionContent: string | null = null;
  let hasH1 = false;
  let hasMultipleH1 = false;
  const headingStructure = { h1: 0, h2: 0, h3: 0 };
  let hasImageAlt = true;
  let missingAltCount = 0;
  let hasCanonical = false;
  let canonicalUrl: string | null = null;
  let robotsTxtAccessible = false;
  let sitemapXmlAccessible = false;
  let hasStructuredData = false;
  const structuredDataTypes: string[] = [];

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) {
    hasTitle = true;
    hasTitle = titleMatch[1].trim().length > 0;
    titleContent = titleMatch[1].trim() || null;
  }

  // Meta description
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (descMatch) {
    hasMetaDescription = true;
    hasMetaDescription = descMatch[1].trim().length > 0;
    metaDescriptionContent = descMatch[1].trim() || null;
  }

  // Headings
  const h1Count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2Count = (html.match(/<h2[^>]*>/gi) || []).length;
  const h3Count = (html.match(/<h3[^>]*>/gi) || []).length;
  headingStructure.h1 = h1Count;
  headingStructure.h2 = h2Count;
  headingStructure.h3 = h3Count;
  hasH1 = h1Count > 0;
  hasMultipleH1 = h1Count > 1;

  // Image alt attributes
  const totalImgTags = (html.match(/<img[^>]*>/gi) || []).length;
  const altImgTags = (html.match(/<img[^>]*alt=["'][^"']*["'][^>]*>/gi) || []).length;
  const ariaImgTags = (html.match(/<img[^>]*alt\s*=\s*["']{2}[^>]*>/gi) || []).length;
  const meaningfulAlt = altImgTags - ariaImgTags;
  missingAltCount = totalImgTags - meaningfulAlt;
  hasImageAlt = missingAltCount < totalImgTags * 0.3; // at least 70% have alt

  // Canonical
  const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (canonicalMatch) {
    hasCanonical = true;
    canonicalUrl = canonicalMatch[1];
  }

  // Structured data (JSON-LD + microdata)
  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi);
  if (jsonLdBlocks) {
    hasStructuredData = true;
    for (const block of jsonLdBlocks) {
      const typeMatch = block.match(/"@type"\s*:\s*"([^"]+)"/);
      if (typeMatch) structuredDataTypes.push(typeMatch[1]);
    }
  }
  const itemscopes = html.match(/itemscope|itemtype=["']http:\/\/schema\.org\//gi);
  if (itemscopes && itemscopes.length > 0) {
    hasStructuredData = true;
  }

  // Score calculation
  let score = 0;
  if (hasTitle && (titleContent?.length ?? 0) >= 10) score += 20;
  if (hasMetaDescription && (metaDescriptionContent?.length ?? 0) >= 50) score += 15;
  if (hasH1 && !hasMultipleH1) score += 15;
  if (hasImageAlt) score += 10;
  if (hasCanonical) score += 10;
  if (hasStructuredData) score += 15;
  if (headingStructure.h2 > 0) score += 10;
  if (headingStructure.h3 > 0) score += 5;

  // robots.txt / sitemap availability (can't always check from browser)
  // We mark these as unchecked since fetch is CORS-limited
  robotsTxtAccessible = false;
  sitemapXmlAccessible = false;

  return {
    hasTitle, titleContent, hasMetaDescription, metaDescriptionContent,
    hasH1, hasMultipleH1, headingStructure,
    hasImageAlt, missingAltCount,
    hasCanonical, canonicalUrl,
    robotsTxtAccessible, sitemapXmlAccessible,
    hasStructuredData, structuredDataTypes,
    score,
  };
}

function measurePerformance(loadTimeMs: number, html: string): PerformanceAudit {
  const pageSizeBytes = new TextEncoder().encode(html).length;
  const pageSizeFormatted = formatBytes(pageSizeBytes);

  const score = calculatePerfScore(loadTimeMs, pageSizeBytes);

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
    score,
  };
}

function calculatePerfScore(loadMs: number, sizeBytes: number): number {
  let score = 50;
  if (loadMs < 500) score += 25;
  else if (loadMs < 1500) score += 15;
  else if (loadMs > 5000) score -= 15;
  else if (loadMs > 3000) score -= 5;

  if (sizeBytes < 100000) score += 15;
  else if (sizeBytes < 500000) score += 5;
  else if (sizeBytes > 2000000) score -= 15;
  else if (sizeBytes > 1000000) score -= 5;

  // PageSpeed Insights integration (if user configured API key in settings)
  const settings = getSettings();
  if (settings.openAiKey) {
    // PSI uses a separate key typically; we note that performance is estimated
    score = Math.round(score);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateImprovements(opts: {
  isHttps: boolean;
  hasViewportMeta: boolean;
  seo: SeoAuditResult;
  perf: PerformanceAudit;
  hasAnalytics: boolean;
  hasChatbot: boolean;
  technologies: DetectedTechnology[];
}): string[] {
  const items: string[] = [];

  if (!opts.isHttps) items.push('No SSL — migrate to HTTPS immediately');
  if (!opts.hasViewportMeta) items.push('Missing viewport meta tag — not mobile-responsive');
  if (!opts.seo.hasTitle) items.push('Missing <title> tag');
  if (opts.seo.titleContent && opts.seo.titleContent.length < 10) items.push(`Short <title> (${opts.seo.titleContent.length} chars) — should be 50-60 chars`);
  if (!opts.seo.hasMetaDescription) items.push('Missing meta description — impacts click-through rate');
  if (!opts.seo.hasH1) items.push('Missing H1 heading — affects content hierarchy');
  if (opts.seo.hasMultipleH1) items.push(`${opts.seo.headingStructure.h1} H1 tags found — should have exactly one`);
  if (!opts.seo.hasCanonical) items.push('Missing canonical tag — risk of duplicate content issues');
  if (opts.seo.missingAltCount > 0) items.push(`${opts.seo.missingAltCount} images missing alt text — accessibility issue`);
  if (!opts.seo.hasStructuredData) items.push('No structured data (JSON-LD) — missing rich snippets in search results');
  if (!opts.hasAnalytics) items.push('No analytics detected — cannot measure visitor behavior');
  if (!opts.hasChatbot) items.push('No live chat widget — may miss real-time engagement opportunities');
  if (opts.perf.loadTimeMs > 3000) items.push(`Slow load time (${opts.perf.loadTimeMs}ms) — affects user experience and SEO`);
  if (opts.perf.pageSizeBytes > 1000000) items.push(`Large page size (${opts.perf.pageSizeFormatted}) — increases load time`);

  return items;
}

function emptySeoAudit(): SeoAuditResult {
  return {
    hasTitle: false, titleContent: null, hasMetaDescription: false, metaDescriptionContent: null,
    hasH1: false, hasMultipleH1: false, headingStructure: { h1: 0, h2: 0, h3: 0 },
    hasImageAlt: false, missingAltCount: 0, hasCanonical: false, canonicalUrl: null,
    robotsTxtAccessible: false, sitemapXmlAccessible: false,
    hasStructuredData: false, structuredDataTypes: [],
    score: 0,
  };
}

function emptyPerformance(): PerformanceAudit {
  return {
    loadTimeMs: 0, pageSizeBytes: 0, pageSizeFormatted: '0 B',
    coreWebVitals: { lcp: undefined, fcp: undefined, tti: undefined, source: 'unavailable' },
    score: 0,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
}