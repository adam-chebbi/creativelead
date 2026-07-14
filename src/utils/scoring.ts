import { Lead, EnrichmentEvidence } from '../types';
import { getSettings } from '../hooks/useSettingsStore';
import { callAi } from './api-client';
import { scrapeWebsiteContacts, ScrapedContacts } from './website-scraper';
import { runEnrichmentApi } from './enrichment-client';

export function generateAIScores(lead: Partial<Lead>): Partial<Lead> {
  const rating = lead.rating;
  const reviewCount = lead.review_count;
  const hasWebsite = !!lead.website;

  let review_reputation: number | null = null;
  if (rating === null || rating === undefined || rating <= 0) {
    review_reputation = null;
  } else {
    let rr = (rating / 5) * 100;
    const cnt = reviewCount ?? 0;
    if (cnt < 5) rr *= 0.5;
    else if (cnt < 10) rr *= 0.7;
    else if (cnt < 30) rr *= 0.85;
    review_reputation = Math.round(rr);
  }

  let website_quality: number | null = null;
  if (lead.website_intelligence && lead.website_intelligence.reachable) {
    const wi = lead.website_intelligence;
    let wq = 0;
    if (wi.reachable) wq += 10;
    if (wi.isHttps) wq += 15;
    if (wi.hasViewportMeta) wq += 10;
    if (wi.seo?.hasTitle) wq += 8;
    if (wi.seo?.hasMetaDescription) wq += 8;
    if (wi.seo?.hasStructuredData) wq += 10;
    if (wi.hasAnalytics) wq += 10;
    if (wi.hasChatbot) wq += 7;
    if (wi.performance?.loadTimeMs !== undefined) {
      if (wi.performance.loadTimeMs < 500) wq += 15;
      else if (wi.performance.loadTimeMs < 1500) wq += 11;
      else if (wi.performance.loadTimeMs < 3000) wq += 6;
      else if (wi.performance.loadTimeMs < 5000) wq += 3;
    }
    website_quality = Math.round(Math.min(100, Math.max(0, wq)));
  } else if (hasWebsite) {
    website_quality = 50;
  } else {
    website_quality = 0;
  }

  let seo_weakness = 0;
  if (!hasWebsite) seo_weakness += 50;
  if (rating === null || rating === undefined || rating <= 0) seo_weakness += 25;
  else if (rating < 4.0) seo_weakness += 25;
  if (reviewCount === null || reviewCount === undefined) seo_weakness += 25;
  else if (reviewCount < 20) seo_weakness += 25;

  let competition_score: number;
  if (reviewCount === null || reviewCount === undefined) {
    competition_score = 50;
  } else {
    competition_score = Math.min(100, Math.round((reviewCount / 500) * 100));
  }

  let growth_score = 100 - competition_score;
  if (rating !== null && rating !== undefined && rating > 0) {
    if (rating > 4.5 && (reviewCount ?? 0) < 50) growth_score += 20;
    else if (rating > 4.0) growth_score += 10;
    else if (rating < 3.0) growth_score -= 15;
  }
  growth_score = Math.round(Math.min(100, Math.max(0, growth_score)));

  let opportunity_score = Math.round((seo_weakness * 0.6) + ((100 - (website_quality ?? 50)) * 0.4));

  const settings = getSettings();
  const w = settings.weights;

  const totalWeight = w.opportunity + w.competition + w.growth + w.seo + w.website + w.reputation;
  const weightFactor = totalWeight > 0 ? totalWeight : 1;

  const wq = website_quality ?? 50;
  const rr = review_reputation ?? 50;

  let ai_score =
    (opportunity_score * (w.opportunity / weightFactor)) +
    ((100 - competition_score) * (w.competition / weightFactor)) +
    (growth_score * (w.growth / weightFactor)) +
    ((100 - seo_weakness) * (w.seo / weightFactor)) +
    (wq * (w.website / weightFactor)) +
    (rr * (w.reputation / weightFactor));

  ai_score = Math.round(Math.min(100, Math.max(0, ai_score)));

  let classification: 'Hot' | 'Warm' | 'Cold' = 'Cold';
  if (ai_score >= 75) classification = 'Hot';
  else if (ai_score >= 40) classification = 'Warm';

  return {
    ai_score, classification, opportunity_score, competition_score,
    growth_score, seo_weakness, website_quality, review_reputation,
    _insufficientData: buildInsufficientDataFlags(rating, reviewCount, lead.website_intelligence),
  };
}

function buildInsufficientDataFlags(rating: number | null | undefined, reviewCount: number | null | undefined, websiteIntel: any): string[] {
  const flags: string[] = [];
  if (rating === null || rating === undefined || rating <= 0) flags.push('review_reputation');
  if (reviewCount === null || reviewCount === undefined) flags.push('competition');
  if (!websiteIntel?.reachable) flags.push('website_quality');
  return flags;
}

export async function generateLiveEnrichment(lead: Partial<Lead>): Promise<Partial<Lead>> {
  const evidence: EnrichmentEvidence = {
    emails: [],
    additional_phones: [],
    linkedin: [],
    facebook: [],
    instagram: [],
    tiktok: [],
    youtube: [],
    business_size: [],
    revenue_estimation: [],
    industry_classification: [],
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

  // Step 1: Website scrape (real HTML fetch)
  const website = lead.website || lead.website;
  if (website && isValidUrl(website)) {
    try {
      const scraped = await scrapeWebsiteContacts(website);
      scrapeText = scraped.rawText.slice(0, 3000);
      scrapeTitle = scraped.pageTitle;
      scrapeDesc = scraped.description;

      for (const e of scraped.emails) {
        foundEmails.push(e.email);
        evidence.emails.push({
          type: 'website_scrape',
          label: `Found on website (${e.source})`,
          url: website,
          confidence: 'high',
        });
      }

      for (const p of scraped.phones) {
        foundPhones.push(p.phone);
        evidence.additional_phones.push({
          type: 'website_scrape',
          label: `Found on website (${p.source})`,
          url: website,
          confidence: 'high',
        });
      }

      const socialMap: [keyof ScrapedContacts['socialLinks'], keyof EnrichmentEvidence][] = [
        ['linkedin', 'linkedin'],
        ['facebook', 'facebook'],
        ['instagram', 'instagram'],
        ['tiktok', 'tiktok'],
        ['youtube', 'youtube'],
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
    } catch {
      // scrape failed — continue
    }
  }

  // Step 2: Enrichment API (Hunter / Clearbit / Apollo)
  const settings = getSettings();
  const hasApiKey = settings.enrichmentKey && settings.enrichmentProvider !== 'none';
  if (hasApiKey && website && isValidUrl(website)) {
    try {
      const domain = extractDomain(website);
      if (domain) {
        const apiResult = await runEnrichmentApi(domain, lead.business_name || '');
        for (const e of apiResult.emails) {
          if (!foundEmails.includes(e.email)) {
            foundEmails.push(e.email);
            evidence.emails.push({
              type: 'enrichment_api',
              label: `${settings.enrichmentProvider}.io: ${e.source || 'direct lookup'}`,
              confidence: e.confidence,
            });
          }
        }
        if (apiResult.linkedin && !linkedin) {
          linkedin = apiResult.linkedin;
          evidence.linkedin.push({ type: 'enrichment_api', label: `${settings.enrichmentProvider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.facebook && !facebook) {
          facebook = apiResult.facebook;
          evidence.facebook.push({ type: 'enrichment_api', label: `${settings.enrichmentProvider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.instagram && !instagram) {
          instagram = apiResult.instagram;
          evidence.instagram.push({ type: 'enrichment_api', label: `${settings.enrichmentProvider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.tiktok && !tiktok) {
          tiktok = apiResult.tiktok;
          evidence.tiktok.push({ type: 'enrichment_api', label: `${settings.enrichmentProvider}.io API response`, confidence: 'medium' });
        }
        if (apiResult.youtube && !youtube) {
          youtube = apiResult.youtube;
          evidence.youtube.push({ type: 'enrichment_api', label: `${settings.enrichmentProvider}.io API response`, confidence: 'medium' });
        }
      }
    } catch {
      // API failed — continue
    }
  }

  // Step 3: AI estimate for size / revenue / industry / description
  const hasRealData = foundEmails.length > 0 || foundPhones.length > 0 || scrapeText.length > 100;

  if (hasRealData) {
    try {
      const aiResult = await callAiForEstimate(lead, scrapeText, scrapeTitle, scrapeDesc);
      if (aiResult) {
        if (aiResult.businessSize) {
          evidence.business_size.push({ type: 'ai_estimate', label: `AI estimate (conf: ${aiResult.confidence})`, confidence: aiResult.confidence === 'high' ? 'high' : aiResult.confidence === 'medium' ? 'medium' : 'low' });
        }
        if (aiResult.revenue) {
          evidence.revenue_estimation.push({ type: 'ai_estimate', label: `AI estimate (conf: ${aiResult.confidence})`, confidence: aiResult.confidence === 'high' ? 'high' : aiResult.confidence === 'medium' ? 'medium' : 'low' });
        }
        if (aiResult.industry) {
          evidence.industry_classification.push({ type: 'ai_estimate', label: `AI estimate (conf: ${aiResult.confidence})`, confidence: aiResult.confidence === 'high' ? 'high' : aiResult.confidence === 'medium' ? 'medium' : 'low' });
        }
        evidence.generated_description.push({ type: 'ai_estimate', label: `AI-generated description`, confidence: aiResult.confidence || 'low' });

        return {
          emails: foundEmails.length > 0 ? foundEmails : undefined,
          additional_phones: foundPhones.length > 0 ? foundPhones : undefined,
          linkedin, facebook, instagram, tiktok, youtube,
          business_size: aiResult.businessSize || 'Insufficient data',
          employee_estimation: aiResult.businessSize || 'Insufficient data',
          revenue_estimation: aiResult.revenue || 'Insufficient data',
          industry_classification: aiResult.industry || lead.category || 'Insufficient data',
          generated_description: aiResult.description || 'Insufficient data for description generation.',
          enrichment_status: 'enriched' as const,
          enrichment_confidence: aiResult.confidence || 'low',
          enrichment_evidence: evidence,
          enrichment_last_run: new Date().toISOString(),
        };
      }
    } catch {
      // AI failed — return scrape+API results
    }
  }

  // Fallback: return what scrape+API provided, mark as failed if no data at all
  const hadAnySource = website || hasApiKey;
  const foundAnything = foundEmails.length > 0 || foundPhones.length > 0 || linkedin || facebook || instagram || tiktok || youtube;

  if (foundAnything) {
    return {
      emails: foundEmails.length > 0 ? foundEmails : undefined,
      additional_phones: foundPhones.length > 0 ? foundPhones : undefined,
      linkedin, facebook, instagram, tiktok, youtube,
      business_size: 'Insufficient data',
      employee_estimation: 'Insufficient data',
      revenue_estimation: 'Insufficient data',
      industry_classification: lead.category || 'Insufficient data',
      generated_description: 'AI estimate unavailable — no API key configured.',
      enrichment_status: 'enriched' as const,
      enrichment_confidence: 'low',
      enrichment_evidence: evidence,
      enrichment_last_run: new Date().toISOString(),
    };
  }

  return {
    enrichment_status: 'failed' as const,
    enrichment_error: hadAnySource ? 'Website unreachable — could not fetch any data.' : 'No enrichment source available — provide a website URL or configure an enrichment API key in Settings.',
    enrichment_evidence: evidence,
    enrichment_last_run: new Date().toISOString(),
  };
}

// ---- AI Estimate ----

interface AiEstimate {
  businessSize: string;
  revenue: string;
  industry: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
}

async function callAiForEstimate(lead: Partial<Lead>, pageText: string, pageTitle: string, pageDesc: string): Promise<AiEstimate | null> {
  const prompt = `You are a business intelligence analyst. Analyze the following business profile and return a JSON object with four fields — nothing else.

Business name: ${lead.business_name || 'N/A'}
Category: ${lead.category || 'N/A'}
City: ${lead.city || 'N/A'}
Rating: ${lead.rating || 'N/A'}/5
Review count: ${lead.review_count || 'N/A'}
${lead.description ? `Existing description: ${lead.description}` : ''}
${pageTitle ? `Website title: ${pageTitle}` : ''}
${pageDesc ? `Website meta description: ${pageDesc}` : ''}
${pageText ? `Website content (first 2000 chars): ${pageText.slice(0, 2000)}` : ''}

Return ONLY valid JSON with these fields:
{
  "businessSize": "estimate like '1-10 employees' or 'insufficient data'",
  "revenue": "estimate like '< $1M' or 'insufficient data'",
  "industry": "specific industry classification or 'insufficient data'",
  "description": "1-2 sentence business summary",
  "confidence": "high, medium or low"
}

CRITICAL: If the provided data is insufficient to estimate a field confidently, write "insufficient data" for that field. Do NOT invent values from name length, city, or rating alone. Confidence should reflect overall data quality.`;

  const result = await callAi({
    prompt,
    temperature: 0.15,
    maxTokens: 500,
  });

  if (!result.ok) return null;

  try {
    const parsed = JSON.parse(extractJson(result.text));
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

function extractJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

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