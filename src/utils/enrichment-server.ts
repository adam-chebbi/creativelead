import { prisma } from '@/lib/prisma';
import { scoreLeadById } from './score-lead-server';
import { analyzeOpportunity } from './opportunity-server';

const FETCH_TIMEOUT_MS = 15000;
const COOLDOWN_MS = 5 * 60 * 1000;

export interface EnrichmentApiConfig {
  provider: 'hunter' | 'clearbit' | 'apollo' | 'none';
  apiKey: string;
}

export interface AiEnrichmentConfig {
  provider: string;
  model: string;
  apiKey: string;
  apiBase?: string;
}

interface ScrapedPage {
  html: string;
  loadTimeMs: number;
  error: string | null;
}

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

interface EvidenceEntry {
  type: 'website_scrape' | 'enrichment_api' | 'ai_estimate';
  label: string;
  url?: string;
  confidence: 'high' | 'medium' | 'low';
}

interface EvidenceTrail {
  emails: EvidenceEntry[];
  additional_phones: EvidenceEntry[];
  linkedin: EvidenceEntry[];
  facebook: EvidenceEntry[];
  instagram: EvidenceEntry[];
  tiktok: EvidenceEntry[];
  youtube: EvidenceEntry[];
  business_size: EvidenceEntry[];
  revenue_estimation: EvidenceEntry[];
  industry_classification: EvidenceEntry[];
  generated_description: EvidenceEntry[];
}

const SOCIAL_PATTERNS: Record<string, RegExp> = {
  linkedin: /linkedin\.com\/(company|in|school)\/[a-z0-9_-]+/i,
  facebook: /facebook\.com\/([a-z0-9._-]+)/i,
  instagram: /instagram\.com\/([a-z0-9._-]+)/i,
  tiktok: /tiktok\.com\/@?([a-z0-9._-]+)/i,
  youtube: /youtube\.com\/(c|channel|user|@[a-z0-9_-]+)/i,
};

function extractDomain(url: string): string | null {
  try {
    const u = url.startsWith('http') ? new URL(url) : new URL('https://' + url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isValidUrl(s: string): boolean {
  try {
    const u = s.startsWith('http') ? new URL(s) : new URL('https://' + s);
    return u.hostname.includes('.');
  } catch {
    return false;
  }
}

async function fetchPage(url: string): Promise<ScrapedPage> {
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const startTime = Date.now();
    const resp = await fetch(normalized, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'CreativeLeadBot/1.0 (enrichment; +https://creativelead.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    const loadTimeMs = Date.now() - startTime;
    if (!resp.ok) return { html: '', loadTimeMs, error: `HTTP ${resp.status}` };
    const html = await resp.text();
    return { html, loadTimeMs, error: null };
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { html: '', loadTimeMs: 0, error: 'Timeout after 15s' };
    }
    return { html: '', loadTimeMs: 0, error: err instanceof Error ? err.message : 'Unknown fetch error' };
  }
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

  result.emails = dedupArr(result.emails, e => e.email);
  result.phones = dedupArr(result.phones, p => p.phone);
  for (const key of Object.keys(result.socialLinks) as (keyof SocialLinks)[]) {
    result.socialLinks[key] = [...new Set(result.socialLinks[key])];
  }

  return result;
}

async function callEnrichmentApi(
  domain: string,
  companyName: string,
  config: EnrichmentApiConfig,
): Promise<{
  emails: { email: string; confidence: 'high' | 'medium' | 'low'; source?: string }[];
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
}> {
  if (config.provider === 'none' || !config.apiKey) {
    return { emails: [] };
  }

  const result: {
    emails: { email: string; confidence: 'high' | 'medium' | 'low'; source?: string }[];
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    tiktok?: string;
    youtube?: string;
  } = { emails: [] };

  try {
    switch (config.provider) {
      case 'hunter': {
        const resp = await fetch(
          `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${config.apiKey}`,
          { signal: AbortSignal.timeout(10000) },
        );
        if (!resp.ok) return result;
        const data = await resp.json();
        if (data?.data?.emails) {
          for (const entry of data.data.emails) {
            const email = entry.value || entry.email;
            if (email) {
              let confidence: 'high' | 'medium' | 'low' = 'medium';
              if (entry.confidence && entry.confidence >= 90) confidence = 'high';
              else if (entry.confidence && entry.confidence < 50) confidence = 'low';
              result.emails.push({ email, confidence, source: entry.sources?.[0]?.domain || 'hunter.io' });
            }
          }
        }
        break;
      }
      case 'clearbit': {
        const resp = await fetch(
          `https://person.clearbit.com/v1/combined/find?email=${encodeURIComponent('info@' + domain)}`,
          {
            headers: { 'Authorization': `Bearer ${config.apiKey}` },
            signal: AbortSignal.timeout(10000),
          },
        );
        if (!resp.ok) return result;
        const data = await resp.json();
        if (data?.person?.email) {
          result.emails.push({ email: data.person.email, confidence: 'high', source: 'clearbit' });
        }
        if (data?.company) {
          if (data.company.linkedin?.handle) {
            result.linkedin = `https://linkedin.com/company/${data.company.linkedin.handle}`;
          }
          if (data.company.facebook?.handle) {
            result.facebook = `https://facebook.com/${data.company.facebook.handle}`;
          }
        }
        break;
      }
      case 'apollo': {
        const resp = await fetch('https://api.apollo.io/v1/people/match', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'x-api-key': config.apiKey,
          },
          body: JSON.stringify({ domain, organization_name: companyName }),
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) return result;
        const data = await resp.json();
        if (data?.person?.email) {
          result.emails.push({ email: data.person.email, confidence: 'medium', source: 'apollo.io' });
        }
        if (data?.organization) {
          if (data.organization.linkedin_url) result.linkedin = data.organization.linkedin_url;
          if (data.organization.facebook_url) result.facebook = data.organization.facebook_url;
        }
        break;
      }
    }
  } catch {
    // API unreachable — return what we have
  }

  return result;
}

async function callAiForEstimate(
  lead: {
    businessName: string | null | undefined;
    category: string | null | undefined;
    city: string | null | undefined;
    rating: number | null | undefined;
    reviewCount: number | null | undefined;
    description: string | null | undefined;
  },
  scrapeText: string,
  pageTitle: string,
  pageDesc: string,
  aiConfig: AiEnrichmentConfig,
): Promise<{
  businessSize: string;
  revenue: string;
  industry: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
} | null> {
  const baseUrl = aiConfig.apiBase || 'https://api.openai.com/v1';

  const prompt = `You are a business intelligence analyst. Analyze the following business profile and return a JSON object with four fields — nothing else.

Business name: ${lead.businessName || 'N/A'}
Category: ${lead.category || 'N/A'}
City: ${lead.city || 'N/A'}
Rating: ${lead.rating || 'N/A'}/5
Review count: ${lead.reviewCount || 'N/A'}
${lead.description ? `Existing description: ${lead.description}` : ''}
${pageTitle ? `Website title: ${pageTitle}` : ''}
${pageDesc ? `Website meta description: ${pageDesc}` : ''}
${scrapeText ? `Website content (first 2000 chars): ${scrapeText.slice(0, 2000)}` : ''}

Return ONLY valid JSON with these fields:
{
  "businessSize": "estimate like '1-10 employees' or 'insufficient data'",
  "revenue": "estimate like '< $1M' or 'insufficient data'",
  "industry": "specific industry classification or 'insufficient data'",
  "description": "1-2 sentence business summary",
  "confidence": "high, medium or low"
}

CRITICAL: If the provided data is insufficient to estimate a field confidently, write "insufficient data" for that field. Do NOT invent values from name length, city, or rating alone. Confidence should reflect overall data quality.`;

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a business intelligence analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.15,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) return null;

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      businessSize: parsed.businessSize || 'Insufficient data',
      revenue: parsed.revenue || 'Insufficient data',
      industry: parsed.industry || 'Insufficient data',
      description: parsed.description || 'Insufficient data for description generation.',
      confidence: parsed.confidence || 'low',
    };
  } catch {
    return null;
  }
}

export async function enrichLead(
  leadId: string,
  orgId: string,
  aiConfig?: AiEnrichmentConfig,
  enrichmentApiConfig?: EnrichmentApiConfig,
  force = false,
): Promise<{ ok: boolean; error?: string }> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
  });

  if (!lead) return { ok: false, error: 'Lead not found' };

  if (!force) {
    const existing = await prisma.leadEnrichment.findUnique({ where: { leadId } });
    if (existing?.lastRunAt) {
      const elapsed = Date.now() - existing.lastRunAt.getTime();
      if (elapsed < COOLDOWN_MS && existing.status === 'enriched') {
        return { ok: true, error: `Skipped — last run was ${Math.round(elapsed / 1000)}s ago (cooldown: ${COOLDOWN_MS / 1000}s)` };
      }
    }
  }

  await prisma.leadEnrichment.upsert({
    where: { leadId },
    create: { leadId, status: 'queued' },
    update: { status: 'queued' },
  });

  await prisma.backgroundJob.create({
    data: {
      leadId,
      jobType: 'enrichment',
      status: 'running',
      startedAt: new Date(),
    },
  });

  try {
    const evidence: EvidenceTrail = {
      emails: [], additional_phones: [], linkedin: [], facebook: [],
      instagram: [], tiktok: [], youtube: [],
      business_size: [], revenue_estimation: [], industry_classification: [],
      generated_description: [],
    };

    const foundEmails: string[] = [];
    const foundPhones: string[] = [];
    let linkedin: string | undefined;
    let facebook: string | undefined;
    let instagram: string | undefined;
    let tiktok: string | undefined;
    let youtube: string | undefined;

    let scrapeText = '';
    let scrapeTitle = '';
    let scrapeDesc = '';

    const hasWebsite = !!lead.website && isValidUrl(lead.website);
    const resolvedApiKey = enrichmentApiConfig?.apiKey || process.env.ENRICHMENT_API_KEY || '';
    const resolvedProvider = enrichmentApiConfig?.provider || (process.env.ENRICHMENT_PROVIDER as any) || 'none';
    const hasApiKey = !!(resolvedApiKey && resolvedProvider !== 'none');
    const effectiveConfig = enrichmentApiConfig || (resolvedApiKey ? { provider: resolvedProvider, apiKey: resolvedApiKey } : undefined);

    if (!hasWebsite && !hasApiKey) {
      await saveEnrichmentResult(leadId, {
        status: 'failed',
        errorMessage: 'No enrichment source available — provide a website URL or configure an enrichment API key in Settings.',
        evidence,
      });
      return { ok: false, error: 'No enrichment source available' };
    }

    // Step 1: Website scrape
    if (hasWebsite && lead.website) {
      const fetched = await fetchPage(lead.website);
      if (!fetched.error && fetched.html) {
        const scraped = scrapePage(fetched.html, lead.website);
        scrapeText = scraped.rawText.slice(0, 3000);
        scrapeTitle = scraped.pageTitle;
        scrapeDesc = scraped.description;

        for (const e of scraped.emails) {
          foundEmails.push(e.email);
          evidence.emails.push({
            type: 'website_scrape',
            label: `Found on website (${e.source})`,
            url: lead.website!,
            confidence: 'high',
          });
        }

        for (const p of scraped.phones) {
          foundPhones.push(p.phone);
          evidence.additional_phones.push({
            type: 'website_scrape',
            label: `Found on website (${p.source})`,
            url: lead.website!,
            confidence: 'high',
          });
        }

        const socialMap: [keyof SocialLinks, keyof EvidenceTrail][] = [
          ['linkedin', 'linkedin'], ['facebook', 'facebook'],
          ['instagram', 'instagram'], ['tiktok', 'tiktok'], ['youtube', 'youtube'],
        ];

        for (const [srcField, evField] of socialMap) {
          const urls = scraped.socialLinks[srcField];
          if (urls.length > 0) {
            if (srcField === 'linkedin') linkedin = urls[0];
            if (srcField === 'facebook') facebook = urls[0];
            if (srcField === 'instagram') instagram = urls[0];
            if (srcField === 'tiktok') tiktok = urls[0];
            if (srcField === 'youtube') youtube = urls[0];
            evidence[evField].push({
              type: 'website_scrape',
              label: 'Found on website footer/header',
              url: urls[0],
              confidence: 'high',
            });
          }
        }
      }
    }

    // Step 2: Enrichment API
    if (hasApiKey && hasWebsite && lead.website) {
      const domain = extractDomain(lead.website);
      if (domain) {
        const apiResult = await callEnrichmentApi(domain, lead.businessName || '', effectiveConfig!);
        for (const e of apiResult.emails) {
          if (!foundEmails.includes(e.email)) {
            foundEmails.push(e.email);
            evidence.emails.push({
              type: 'enrichment_api',
              label: `${effectiveConfig!.provider}.io: ${e.source || 'direct lookup'}`,
              confidence: e.confidence,
            });
          }
        }
        if (apiResult.linkedin && !linkedin) {
          linkedin = apiResult.linkedin;
          evidence.linkedin.push({ type: 'enrichment_api', label: `${effectiveConfig!.provider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.facebook && !facebook) {
          facebook = apiResult.facebook;
          evidence.facebook.push({ type: 'enrichment_api', label: `${effectiveConfig!.provider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.instagram && !instagram) {
          instagram = apiResult.instagram;
          evidence.instagram.push({ type: 'enrichment_api', label: `${effectiveConfig!.provider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.tiktok && !tiktok) {
          tiktok = apiResult.tiktok;
          evidence.tiktok.push({ type: 'enrichment_api', label: `${effectiveConfig!.provider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.youtube && !youtube) {
          youtube = apiResult.youtube;
          evidence.youtube.push({ type: 'enrichment_api', label: `${effectiveConfig!.provider}.io API response`, confidence: 'medium' });
        }
      }
    }

    // Step 3: AI estimate
    const hasRealData = foundEmails.length > 0 || foundPhones.length > 0 || scrapeText.length > 100;

    let businessSize: string | undefined;
    let revenueEstimate: string | undefined;
    let industryClassification: string | undefined;
    let generatedDescription: string | undefined;
    let confidenceLevel: 'high' | 'medium' | 'low' | undefined;

    if (hasRealData && aiConfig && aiConfig.apiKey) {
      const aiResult = await callAiForEstimate(
        {
          businessName: lead.businessName,
          category: lead.category,
          city: lead.city,
          rating: lead.rating,
          reviewCount: lead.reviewCount,
          description: null,
        },
        scrapeText,
        scrapeTitle,
        scrapeDesc,
        aiConfig,
      );

      if (aiResult) {
        businessSize = aiResult.businessSize;
        revenueEstimate = aiResult.revenue;
        industryClassification = aiResult.industry;
        generatedDescription = aiResult.description;
        confidenceLevel = aiResult.confidence;

        if (aiResult.businessSize && aiResult.businessSize !== 'Insufficient data') {
          evidence.business_size.push({
            type: 'ai_estimate',
            label: `AI estimate (conf: ${aiResult.confidence})`,
            confidence: aiResult.confidence === 'high' ? 'high' : aiResult.confidence === 'medium' ? 'medium' : 'low',
          });
        }
        if (aiResult.revenue && aiResult.revenue !== 'Insufficient data') {
          evidence.revenue_estimation.push({
            type: 'ai_estimate',
            label: `AI estimate (conf: ${aiResult.confidence})`,
            confidence: aiResult.confidence === 'high' ? 'high' : aiResult.confidence === 'medium' ? 'medium' : 'low',
          });
        }
        if (aiResult.industry && aiResult.industry !== 'Insufficient data') {
          evidence.industry_classification.push({
            type: 'ai_estimate',
            label: `AI estimate (conf: ${aiResult.confidence})`,
            confidence: aiResult.confidence === 'high' ? 'high' : aiResult.confidence === 'medium' ? 'medium' : 'low',
          });
        }
        if (aiResult.description && aiResult.description !== 'Insufficient data for description generation.') {
          evidence.generated_description.push({
            type: 'ai_estimate',
            label: 'AI-generated description',
            confidence: aiResult.confidence || 'low',
          });
        }
      }
    }

    // Determine final enrichment status
    const foundAnything = foundEmails.length > 0 || foundPhones.length > 0 ||
      linkedin || facebook || instagram || tiktok || youtube ||
      (businessSize && businessSize !== 'Insufficient data');

    let status: string;
    if (foundAnything) {
      status = 'enriched';
      if (hasRealData && !confidenceLevel) {
        status = 'partially_enriched';
      }
    } else if (hasWebsite || hasApiKey) {
      status = 'failed';
    } else {
      status = 'failed';
    }

    await saveEnrichmentResult(leadId, {
      emails: foundEmails.length > 0 ? foundEmails : undefined,
      additionalPhones: foundPhones.length > 0 ? foundPhones : undefined,
      linkedinUrl: linkedin,
      facebookUrl: facebook,
      instagramUrl: instagram,
      tiktokUrl: tiktok,
      youtubeUrl: youtube,
      businessSize,
      revenueEstimate,
      industryClassification,
      generatedDescription,
      status,
      confidenceLevel,
      evidence,
      errorMessage: status === 'failed'
        ? (hasWebsite ? 'Website unreachable — could not fetch any data.' : 'No enrichment source available — provide a website URL or configure an enrichment API key in Settings.')
        : undefined,
    });

    // Trigger rescoring + opportunity analysis after enrichment
    try {
      await scoreLeadById(leadId, orgId);
    } catch (err) {
      console.error(`[enrichment] rescore failed for ${leadId}:`, err);
    }
    try {
      await analyzeOpportunity(leadId, orgId);
    } catch (err) {
      console.error(`[enrichment] opportunity analysis failed for ${leadId}:`, err);
    }

    // Update background job
    await prisma.backgroundJob.updateMany({
      where: { leadId, jobType: 'enrichment', status: 'running' },
      data: { status: 'done', finishedAt: new Date() },
    });

    return { ok: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown enrichment error';

    await saveEnrichmentResult(leadId, {
      status: 'failed',
      errorMessage,
    });

    await prisma.backgroundJob.updateMany({
      where: { leadId, jobType: 'enrichment', status: 'running' },
      data: { status: 'failed', errorMessage, finishedAt: new Date() },
    });

    return { ok: false, error: errorMessage };
  }
}

async function saveEnrichmentResult(
  leadId: string,
  data: {
    emails?: string[];
    additionalPhones?: string[];
    linkedinUrl?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    tiktokUrl?: string;
    youtubeUrl?: string;
    businessSize?: string;
    revenueEstimate?: string;
    industryClassification?: string;
    generatedDescription?: string;
    status: string;
    confidenceLevel?: string;
    evidence?: EvidenceTrail;
    errorMessage?: string;
  },
): Promise<void> {
  const createData: Record<string, unknown> = {
    leadId,
    status: data.status,
    lastRunAt: new Date(),
  };
  const updateData: Record<string, unknown> = {
    status: data.status,
    lastRunAt: new Date(),
  };

  if (data.emails !== undefined) {
    createData.emails = data.emails;
    updateData.emails = data.emails;
  }
  if (data.additionalPhones !== undefined) {
    createData.additionalPhones = data.additionalPhones;
    updateData.additionalPhones = data.additionalPhones;
  }
  if (data.linkedinUrl !== undefined) {
    createData.linkedinUrl = data.linkedinUrl;
    updateData.linkedinUrl = data.linkedinUrl;
  }
  if (data.facebookUrl !== undefined) {
    createData.facebookUrl = data.facebookUrl;
    updateData.facebookUrl = data.facebookUrl;
  }
  if (data.instagramUrl !== undefined) {
    createData.instagramUrl = data.instagramUrl;
    updateData.instagramUrl = data.instagramUrl;
  }
  if (data.tiktokUrl !== undefined) {
    createData.tiktokUrl = data.tiktokUrl;
    updateData.tiktokUrl = data.tiktokUrl;
  }
  if (data.youtubeUrl !== undefined) {
    createData.youtubeUrl = data.youtubeUrl;
    updateData.youtubeUrl = data.youtubeUrl;
  }
  if (data.businessSize !== undefined) {
    createData.businessSize = data.businessSize;
    updateData.businessSize = data.businessSize;
  }
  if (data.revenueEstimate !== undefined) {
    createData.revenueEstimate = data.revenueEstimate;
    updateData.revenueEstimate = data.revenueEstimate;
  }
  if (data.industryClassification !== undefined) {
    createData.industryClassification = data.industryClassification;
    updateData.industryClassification = data.industryClassification;
  }
  if (data.generatedDescription !== undefined) {
    createData.generatedDescription = data.generatedDescription;
    updateData.generatedDescription = data.generatedDescription;
  }
  if (data.confidenceLevel !== undefined) {
    createData.confidenceLevel = data.confidenceLevel;
    updateData.confidenceLevel = data.confidenceLevel;
  }
  if (data.evidence !== undefined) {
    createData.evidenceTrail = data.evidence;
    updateData.evidenceTrail = data.evidence;
  }

  await prisma.leadEnrichment.upsert({
    where: { leadId },
    create: createData as any,
    update: updateData as any,
  });
}

export async function queueEnrichment(leadId: string, orgId: string): Promise<void> {
  try {
    await enrichLead(leadId, orgId);
  } catch (err) {
    console.error(`[enrichment] queued enrichment failed for ${leadId}:`, err);
  }
}

function dedupArr<T>(arr: T[], keyFn: (t: T) => string): T[] {
  const seen = new Set<string>();
  return arr.filter(item => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
