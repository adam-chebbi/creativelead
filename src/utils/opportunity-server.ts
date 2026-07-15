import { prisma } from '@/lib/prisma';
import { scoreLeadById } from './score-lead-server';

interface PricingConfig {
  websiteBuild: number;
  websiteRedesign: number;
  seoAudit: number;
  seoMonthly: number;
  socialSetup: number;
  socialManagement: number;
  reviewManagement: number;
  localCitation: number;
  fullDigitalAudit: number;
}

interface ThresholdConfig {
  lowReviewCount: number;
  lowRatingBar: number;
  minReviewsForRating: number;
}

interface DetectedGap {
  type: string;
  label: string;
  severity: string;
  detail: string;
  detected: boolean;
}

interface ConversionFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  reason: string;
  weight: number;
}

interface DealValueBreakdown {
  baseServicePrice: number;
  gapMultiplier: number;
  categoryAdjustment: number;
  finalValue: number;
  gapsFound: number;
  industry: string;
}

const PRICING_DEFAULTS: PricingConfig = {
  websiteBuild: 2500,
  websiteRedesign: 1800,
  seoAudit: 1200,
  seoMonthly: 800,
  socialSetup: 600,
  socialManagement: 1500,
  reviewManagement: 500,
  localCitation: 400,
  fullDigitalAudit: 900,
};

const THRESHOLD_DEFAULTS: ThresholdConfig = {
  lowReviewCount: 10,
  lowRatingBar: 3.5,
  minReviewsForRating: 3,
};

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

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

interface LeadData {
  id: string;
  businessName: string | null;
  category: string | null;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  enrichment?: {
    emails: string[];
    additionalPhones: string[];
    linkedinUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl: string | null;
  } | null;
  websiteIntel?: {
    reachable: boolean | null;
    isHttps: boolean | null;
    hasViewportMeta: boolean | null;
    seoScore: number | null;
    performanceScore: number | null;
    loadTimeMs: number | null;
    hasAnalytics: boolean | null;
    analyticsTools: string[];
    hasChatbot: boolean | null;
    chatbotTools: string[];
    detectedTechnologies: any;
    hasTitle: boolean | null;
    hasMetaDescription: boolean | null;
    hasStructuredData: boolean | null;
    missingAltCount: number | null;
    totalImgTags: number | null;
  } | null;
}

async function getLeadData(leadId: string, orgId: string): Promise<LeadData | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: orgId },
    include: {
      enrichment: true,
      websiteIntel: true,
    },
  });
  if (!lead) return null;

  return {
    id: lead.id,
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    website: lead.website,
    email: lead.email,
    phone: lead.phone,
    description: null,
    enrichment: lead.enrichment ? {
      emails: lead.enrichment.emails,
      additionalPhones: lead.enrichment.additionalPhones,
      linkedinUrl: lead.enrichment.linkedinUrl,
      facebookUrl: lead.enrichment.facebookUrl,
      instagramUrl: lead.enrichment.instagramUrl,
      tiktokUrl: lead.enrichment.tiktokUrl,
      youtubeUrl: lead.enrichment.youtubeUrl,
    } : null,
    websiteIntel: lead.websiteIntel ? {
      reachable: lead.websiteIntel.reachable,
      isHttps: lead.websiteIntel.isHttps,
      hasViewportMeta: lead.websiteIntel.hasViewportMeta,
      seoScore: lead.websiteIntel.seoScore,
      performanceScore: lead.websiteIntel.performanceScore,
      loadTimeMs: lead.websiteIntel.loadTimeMs,
      hasAnalytics: lead.websiteIntel.hasAnalytics,
      analyticsTools: lead.websiteIntel.analyticsTools,
      hasChatbot: lead.websiteIntel.hasChatbot,
      chatbotTools: lead.websiteIntel.chatbotTools,
      detectedTechnologies: lead.websiteIntel.detectedTechnologies,
      hasTitle: lead.websiteIntel.hasTitle,
      hasMetaDescription: lead.websiteIntel.hasMetaDescription,
      hasStructuredData: lead.websiteIntel.hasStructuredData,
      missingAltCount: lead.websiteIntel.missingAltCount,
      totalImgTags: lead.websiteIntel.totalImgTags,
    } : null,
  };
}

function detectGaps(
  lead: LeadData,
  thresholds: ThresholdConfig,
): DetectedGap[] {
  const gaps: DetectedGap[] = [];
  const wi = lead.websiteIntel;
  const hasWebsite = !!lead.website;
  const websiteUrl = lead.website;

  // Website quality assessment
  if (!hasWebsite) {
    gaps.push({ type: 'no_website', label: 'No Website', severity: 'critical', detail: 'Business has no website at all', detected: true });
  } else if (wi && wi.reachable) {
    const signals: string[] = [];
    if (!wi.isHttps) signals.push('No HTTPS');
    if (!wi.hasViewportMeta) signals.push('Not mobile-responsive');
    if (wi.seoScore !== null && wi.seoScore < 40) signals.push(`Poor SEO score (${wi.seoScore}/100)`);
    if (wi.performanceScore !== null && wi.performanceScore < 40) signals.push(`Poor performance (${wi.performanceScore}/100)`);
    if (wi.loadTimeMs !== null && wi.loadTimeMs > 3000) signals.push(`Slow load time: ${wi.loadTimeMs}ms`);
    if (!wi.hasAnalytics) signals.push('No analytics found');
    if (wi.hasChatbot === false) signals.push('No live chat widget');
    if (signals.length > 0) {
      gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'moderate', detail: 'Website issues: ' + signals.join(', '), detected: true });
    } else {
      gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'minor', detail: 'Website looks solid', detected: false });
    }
  } else if (hasWebsite && (!wi || !wi.reachable)) {
    gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'moderate', detail: 'Website URL provided but unreachable or not yet analyzed', detected: true });
  } else {
    gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'minor', detail: 'Website looks solid', detected: false });
  }

  // SSL check
  if (wi && wi.reachable && wi.isHttps === false) {
    gaps.push({ type: 'no_ssl', label: 'No SSL/HTTPS', severity: 'critical', detail: 'Site loads over HTTP — security risk and SEO penalty', detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'no_ssl', label: 'No SSL/HTTPS', severity: 'minor', detail: 'HTTPS active', detected: false });
  }

  // Performance
  if (wi && wi.reachable && wi.loadTimeMs !== null && wi.loadTimeMs > 3000) {
    gaps.push({ type: 'slow_site', label: 'Slow Website', severity: 'moderate', detail: `Load time ${wi.loadTimeMs}ms — affects bounce rate`, detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'slow_site', label: 'Slow Website', severity: 'minor', detail: wi.loadTimeMs !== null ? `Load time ${wi.loadTimeMs}ms` : 'Load time unknown', detected: false });
  }

  // Analytics
  if (wi && wi.reachable && !wi.hasAnalytics) {
    gaps.push({ type: 'missing_analytics', label: 'Missing Analytics', severity: 'moderate', detail: 'No Google Analytics, Meta Pixel, or other tracking found', detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'missing_analytics', label: 'Missing Analytics', severity: 'minor', detail: `${wi.analyticsTools.length} analytics tool(s) detected`, detected: false });
  }

  // Chatbot
  if (wi && wi.reachable && wi.hasChatbot === false) {
    gaps.push({ type: 'missing_chatbot', label: 'No Live Chat', severity: 'moderate', detail: 'No chat widget detected — potential missed conversions', detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'missing_chatbot', label: 'No Live Chat', severity: 'minor', detail: `${wi.chatbotTools.length} chat solution(s) detected`, detected: false });
  }

  // Reviews
  const reviewCount = lead.reviewCount || 0;
  const rating = lead.rating;
  if (rating === null || rating === undefined) {
    gaps.push({ type: 'low_reviews', label: 'Reviews Unknown', severity: 'minor', detail: 'No rating data — cannot assess', detected: false });
  } else if (reviewCount < thresholds.minReviewsForRating) {
    gaps.push({ type: 'low_reviews', label: 'Low Reviews', severity: 'moderate', detail: `Only ${reviewCount} review(s) — insufficient volume`, detected: true });
  } else if (rating < thresholds.lowRatingBar) {
    gaps.push({ type: 'low_reviews', label: 'Low Reviews', severity: 'moderate', detail: `Rating ${rating}/5 is below ${thresholds.lowRatingBar} threshold`, detected: true });
  } else {
    gaps.push({ type: 'low_reviews', label: 'Low Reviews', severity: 'minor', detail: `Rating ${rating}/5 with ${reviewCount} reviews — adequate`, detected: false });
  }

  // Social presence
  const socialCount = countSocialProfiles(lead);
  if (socialCount === 0) {
    gaps.push({ type: 'no_social', label: 'No Social Presence', severity: 'critical', detail: 'No Facebook, Instagram, LinkedIn, TikTok, or YouTube profiles found', detected: true });
  } else {
    gaps.push({ type: 'no_social', label: 'No Social Presence', severity: 'minor', detail: `${socialCount} social profile(s) found`, detected: false });
  }

  // SEO gaps
  const seoFlags = detectSeoFlags(lead);
  if (seoFlags.length > 0) {
    gaps.push({
      type: 'no_seo',
      label: 'SEO Gaps',
      severity: seoFlags.length > 2 ? 'critical' : 'moderate',
      detail: seoFlags.join('; '),
      detected: true,
    });
  } else {
    gaps.push({ type: 'no_seo', label: 'SEO Gaps', severity: 'minor', detail: 'No obvious SEO gaps', detected: false });
  }

  // Phone
  const hasPhone = hasValue(lead.phone) || (lead.enrichment?.additionalPhones && lead.enrichment.additionalPhones.length > 0);
  if (!hasPhone) {
    gaps.push({ type: 'no_phone', label: 'No Phone Listed', severity: 'moderate', detail: 'Phone number is missing — potential lost calls', detected: true });
  } else {
    gaps.push({ type: 'no_phone', label: 'No Phone Listed', severity: 'minor', detail: 'Phone number present', detected: false });
  }

  // Email
  const hasEmail = hasValue(lead.email) || (lead.enrichment?.emails && lead.enrichment.emails.length > 0);
  if (!hasEmail) {
    gaps.push({ type: 'no_email', label: 'No Email Listed', severity: 'moderate', detail: 'Email address is missing', detected: true });
  } else {
    gaps.push({ type: 'no_email', label: 'No Email Listed', severity: 'minor', detail: 'Email present', detected: false });
  }

  return gaps;
}

function countSocialProfiles(lead: LeadData): number {
  let count = 0;
  if (lead.enrichment) {
    if (lead.enrichment.linkedinUrl) count++;
    if (lead.enrichment.facebookUrl) count++;
    if (lead.enrichment.instagramUrl) count++;
    if (lead.enrichment.tiktokUrl) count++;
    if (lead.enrichment.youtubeUrl) count++;
  }
  return count;
}

function detectSeoFlags(lead: LeadData): string[] {
  const flags: string[] = [];
  const wi = lead.websiteIntel;

  if (wi && wi.reachable) {
    if (!wi.hasTitle) flags.push('No <title> tag');
    if (!wi.hasMetaDescription) flags.push('No meta description');
    if (!wi.hasViewportMeta) flags.push('Not mobile-responsive');
    if (wi.loadTimeMs !== null && wi.loadTimeMs > 3000) flags.push(`Slow load time (${wi.loadTimeMs}ms)`);
    if (!wi.hasStructuredData) flags.push('No structured data');
    if (wi.seoScore !== null && wi.seoScore < 30) flags.push(`Low SEO score (${wi.seoScore}/100)`);
    return flags;
  }

  if (!hasValue(lead.website)) flags.push('No website to optimize for search');
  if (lead.reviewCount !== null && lead.reviewCount < 5) flags.push('Low review count — limited local ranking signals');
  if (!hasValue(lead.category)) flags.push('No category — weak topical relevance');

  return flags;
}

function computeConversionProbability(
  lead: LeadData,
  gaps: DetectedGap[],
): { probability: number; factors: ConversionFactor[] } {
  const factors: ConversionFactor[] = [];
  let score = 50;

  const hasPhone = hasValue(lead.phone) || (lead.enrichment?.additionalPhones && lead.enrichment.additionalPhones.length > 0);
  if (hasPhone) {
    score += 12;
    factors.push({ factor: 'Phone listed', impact: 'positive', reason: 'Accessible by phone — easier to contact', weight: 12 });
  } else {
    score -= 5;
    factors.push({ factor: 'No phone listed', impact: 'negative', reason: 'Harder to reach owner directly', weight: -5 });
  }

  const hasEmail = hasValue(lead.email) || (lead.enrichment?.emails && lead.enrichment.emails.length > 0);
  if (hasEmail) {
    score += 10;
    factors.push({ factor: 'Email listed', impact: 'positive', reason: 'Direct email contact available', weight: 10 });
  } else {
    score -= 5;
    factors.push({ factor: 'No email listed', impact: 'negative', reason: 'No direct email channel', weight: -5 });
  }

  const reviewCount = lead.reviewCount || 0;
  if (reviewCount >= 20) {
    score += 8;
    factors.push({ factor: 'Established reputation', impact: 'positive', reason: `${reviewCount} reviews — business is active`, weight: 8 });
  } else if (reviewCount >= 5) {
    factors.push({ factor: 'Some reviews', impact: 'neutral', reason: `${reviewCount} reviews — moderate engagement`, weight: 0 });
  } else {
    score -= 8;
    factors.push({ factor: 'Few reviews', impact: 'negative', reason: `${reviewCount} reviews — low engagement signal`, weight: -8 });
  }

  if (lead.rating !== null && lead.rating !== undefined && reviewCount >= 3) {
    if (lead.rating >= 4.5) {
      score += 10;
      factors.push({ factor: `High rating (${lead.rating}/5)`, impact: 'positive', reason: 'Excellent reputation signals quality business', weight: 10 });
    } else if (lead.rating <= 3.0) {
      score -= 8;
      factors.push({ factor: `Low rating (${lead.rating}/5)`, impact: 'negative', reason: 'Below-average rating may indicate problems', weight: -8 });
    } else {
      factors.push({ factor: `Average rating (${lead.rating}/5)`, impact: 'neutral', reason: 'Adequate reputation', weight: 0 });
    }
  } else {
    score -= 5;
    factors.push({ factor: 'No rating data', impact: 'negative', reason: 'Cannot assess quality signal', weight: -5 });
  }

  const detectedGaps = gaps.filter(g => g.detected);
  const gapCount = detectedGaps.length;
  if (gapCount >= 4) {
    score += 15;
    factors.push({ factor: `${gapCount} gaps detected`, impact: 'positive', reason: 'Many pain points = higher budget receptiveness', weight: 15 });
  } else if (gapCount >= 2) {
    score += 8;
    factors.push({ factor: `${gapCount} gaps detected`, impact: 'positive', reason: 'Multiple gaps increase engagement likelihood', weight: 8 });
  } else if (gapCount === 0) {
    score -= 10;
    factors.push({ factor: 'No gaps detected', impact: 'negative', reason: 'No obvious pain points', weight: -10 });
  } else {
    factors.push({ factor: `${gapCount} gap(s) detected`, impact: 'neutral', reason: 'Moderate opportunity level', weight: 0 });
  }

  const socialCount = countSocialProfiles(lead);
  if (socialCount >= 2) {
    score += 5;
    factors.push({ factor: 'Active social presence', impact: 'positive', reason: `${socialCount} profiles — digitally engaged`, weight: 5 });
  }

  if (hasValue(lead.website)) {
    score += 5;
    factors.push({ factor: 'Has a website', impact: 'positive', reason: 'Already online — easier to upsell', weight: 5 });
  }

  return {
    probability: Math.max(5, Math.min(98, score)),
    factors,
  };
}

function getServiceRecommendation(
  gaps: DetectedGap[],
  lead: LeadData,
  pricing: PricingConfig,
): { service: string; details: string; price: number } {
  const detected = gaps.filter(g => g.detected);
  const industry = lead.category || 'local business';

  const hasNoWebsite = detected.some(g => g.type === 'no_website');
  const hasPoorWebsite = detected.some(g => g.type === 'poor_website');
  const hasLowReviews = detected.some(g => g.type === 'low_reviews');
  const hasNoSocial = detected.some(g => g.type === 'no_social');
  const hasSeoGaps = detected.some(g => g.type === 'no_seo');
  const gapCount = detected.length;

  if (hasNoWebsite) {
    const extra = hasSeoGaps ? ' with built-in SEO structure and local schema' : '';
    return {
      service: 'Website Build Package',
      details: `${lead.businessName} is a ${industry} business with no website. Build a mobile-responsive, SEO-optimized site${extra}.`,
      price: pricing.websiteBuild,
    };
  }

  if (hasPoorWebsite && hasSeoGaps) {
    return {
      service: 'Website Redesign + SEO Audit',
      details: `${lead.businessName} in ${industry} has an existing website with quality issues. Redesign with modern UX plus a full SEO audit and remediation.`,
      price: pricing.websiteRedesign + pricing.seoAudit,
    };
  }

  if (hasSeoGaps && !hasPoorWebsite) {
    const isMonthly = gapCount >= 3;
    return {
      service: isMonthly ? 'SEO Monthly Retainer' : 'SEO Audit Package',
      details: `${lead.businessName} (${industry}) has SEO gaps. Deliver ${isMonthly ? 'monthly SEO management' : 'a one-time SEO audit with recommendations'}.`,
      price: isMonthly ? pricing.seoMonthly : pricing.seoAudit,
    };
  }

  if (hasNoSocial) {
    const bundled = gapCount > 2;
    return {
      service: bundled ? 'Social Media Setup + Management' : 'Social Media Setup Package',
      details: `${lead.businessName} in ${industry} has no social media presence. ${bundled ? 'Set up profiles plus 3 months management.' : 'Set up profiles on the most relevant platforms.'}`,
      price: pricing.socialSetup + (bundled ? pricing.socialManagement : 0),
    };
  }

  if (hasPoorWebsite) {
    return {
      service: 'Website Redesign Package',
      details: `Existing website for ${lead.businessName} (${industry}) needs improvement. Redesign with modern templates and HTTPS.`,
      price: pricing.websiteRedesign,
    };
  }

  if (hasLowReviews) {
    return {
      service: 'Review Management Package',
      details: `${lead.businessName} in ${industry} can benefit from a review generation and management campaign to build social proof.`,
      price: pricing.reviewManagement,
    };
  }

  if (gapCount === 1) {
    return {
      service: 'Local Citation Cleanup',
      details: `Minor gaps (${detected.map(g => g.label).join(', ')}) for ${lead.businessName}. A local citation cleanup improves discoverability.`,
      price: pricing.localCitation,
    };
  }

  return {
    service: 'Full Digital Audit',
    details: `Comprehensive audit for ${lead.businessName} (${industry}) — ${gapCount} gaps found: ${detected.map(g => g.label).join(', ')}.`,
    price: pricing.fullDigitalAudit,
  };
}

function computeDealValue(
  recommendation: { price: number; service: string },
  gaps: DetectedGap[],
  lead: LeadData,
  pricing: PricingConfig,
): { value: number; breakdown: DealValueBreakdown } {
  const detectedCount = gaps.filter(g => g.detected).length;
  const basePrice = recommendation.price;
  const gapMultiplier = 1 + (detectedCount * 0.15);
  const categoryBonus = getCategoryMultiplier(lead.category);
  const finalValue = Math.round(basePrice * gapMultiplier * categoryBonus);

  return {
    value: finalValue,
    breakdown: {
      baseServicePrice: basePrice,
      gapMultiplier: Math.round(gapMultiplier * 100) / 100,
      categoryAdjustment: Math.round(categoryBonus * 100) / 100,
      finalValue,
      gapsFound: detectedCount,
      industry: lead.category || 'Unknown',
    },
  };
}

export async function analyzeOpportunity(
  leadId: string,
  orgId: string,
  pricing?: PricingConfig,
  thresholds?: ThresholdConfig,
): Promise<{ ok: boolean; error?: string }> {
  const lead = await getLeadData(leadId, orgId);
  if (!lead) return { ok: false, error: 'Lead not found' };

  const p = pricing || PRICING_DEFAULTS;
  const t = thresholds || THRESHOLD_DEFAULTS;

  const gaps = detectGaps(lead, t);
  const recommendation = getServiceRecommendation(gaps, lead, p);
  const { value, breakdown } = computeDealValue(recommendation, gaps, lead, p);
  const { probability, factors } = computeConversionProbability(lead, gaps);

  const detectedCount = gaps.filter(g => g.detected).length;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (detectedCount >= 3) confidence = 'high';
  else if (detectedCount <= 1) confidence = 'low';

  await prisma.leadOpportunity.upsert({
    where: { leadId },
    create: {
      leadId,
      detectedGaps: gaps,
      recommendedService: recommendation.service,
      recommendedServiceDetails: recommendation.details,
      estimatedDealValue: value,
      dealValueBreakdown: breakdown,
      conversionProbability: probability / 100,
      conversionFactors: factors,
      confidenceLevel: confidence,
    },
    update: {
      detectedGaps: gaps,
      recommendedService: recommendation.service,
      recommendedServiceDetails: recommendation.details,
      estimatedDealValue: value,
      dealValueBreakdown: breakdown,
      conversionProbability: probability / 100,
      conversionFactors: factors,
      confidenceLevel: confidence,
    },
  });

  await prisma.backgroundJob.create({
    data: {
      leadId,
      jobType: 'opportunity',
      status: 'done',
      startedAt: new Date(),
      finishedAt: new Date(),
    },
  });

  return { ok: true };
}
