import { Lead, OpportunityGap, DealValueBreakdown, ConversionFactor, WebsiteIntelligence } from '../types';
import { getSettings } from '../hooks/useSettingsStore';

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return `https://${trimmed}`;
}

function assessWebsite(website: string | null | undefined, wi?: WebsiteIntelligence | null): { quality: 'good' | 'poor' | 'none'; signals: string[] } {
  const url = normalizeUrl(website);
  if (!url) return { quality: 'none', signals: ['No website URL provided'] };

  const signals: string[] = [];

  if (wi) {
    if (!wi.reachable) {
      signals.push('Website unreachable: ' + (wi.error || 'unknown error'));
      return { quality: 'poor', signals };
    }
    if (!wi.isHttps) signals.push('No HTTPS');
    if (!wi.hasViewportMeta) signals.push('Not mobile-responsive');
    if (wi.seo.score < 40) signals.push('Poor SEO score (' + wi.seo.score + '/100)');
    if (wi.performance.score < 40) signals.push('Poor performance (' + wi.performance.score + '/100)');
    if (wi.performance.loadTimeMs > 3000) signals.push('Slow load time: ' + wi.performance.loadTimeMs + 'ms');
    if (!wi.hasAnalytics) signals.push('No analytics found');
    if (wi.technologies.length === 0) signals.push('Unknown technology stack');
    else {
      const cms = wi.technologies.filter(t => t.category === 'cms');
      if (cms.length === 0) signals.push('No mainstream CMS detected');
    }
    return { quality: signals.length === 0 ? 'good' : 'poor', signals };
  }

  // Fallback (no WebsiteIntelligence available)
  const lower = url.toLowerCase();
  if (!lower.startsWith('https://')) signals.push('No HTTPS');
  const templatePlatforms = ['wix.com', 'squarespace.com', 'weebly.com', 'wordpress.com', 'myshopify.com', 'godaddysites.com'];
  for (const plat of templatePlatforms) {
    if (lower.includes(plat)) { signals.push('Template-based on ' + plat); break; }
  }
  const domain = lower.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  const parts = domain.split('.');
  if (parts.length < 2 || domain.length < 4) signals.push('Suspicious or minimal domain');
  return { quality: signals.length === 0 ? 'good' : 'poor', signals };
}

function countSocialProfiles(lead: Lead): number {
  let count = 0;
  for (const field of ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'] as const) {
    const val = lead[field];
    if (val !== null && val !== undefined && typeof val === 'string' && val.trim().length > 0) count++;
  }
  if (lead.social_profiles && lead.social_profiles.length > 0) count += lead.social_profiles.length;
  return count;
}

function countRealReviews(lead: Lead): number {
  let count = lead.review_count || 0;
  if (lead.reviews && lead.reviews.length > 0) {
    const real = lead.reviews.filter(r => {
      const name = r.reviewer_name;
      const text = r.review_text;
      return (name !== null && name !== undefined && name.trim().length > 0) ||
             (text !== null && text !== undefined && text.trim().length > 0);
    });
    count = Math.max(count, real.length);
  }
  return count;
}

function detectGaps(lead: Lead, thresholds: { lowReviewCount: number; lowRatingBar: number; minReviewsForRating: number }): OpportunityGap[] {
  const gaps: OpportunityGap[] = [];
  const wi = lead.website_intelligence;
  const website = assessWebsite(lead.website, wi);

  if (website.quality === 'none') {
    gaps.push({ type: 'no_website', label: 'No Website', severity: 'critical', detail: 'Business has no website at all', detected: true });
  } else if (website.quality === 'poor') {
    gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'moderate', detail: 'Website issues: ' + website.signals.join(', '), detected: true });
  } else {
    gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'minor', detail: 'Website looks solid', detected: false });
  }

  // SSL check from WebsiteIntelligence
  if (wi && wi.reachable && !wi.isHttps) {
    gaps.push({ type: 'no_ssl', label: 'No SSL/HTTPS', severity: 'critical', detail: 'Site loads over HTTP — security risk and SEO penalty', detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'no_ssl', label: 'No SSL/HTTPS', severity: 'minor', detail: 'HTTPS active', detected: false });
  }

  // Performance from WebsiteIntelligence
  if (wi && wi.reachable && wi.performance.loadTimeMs > 3000) {
    gaps.push({ type: 'slow_site', label: 'Slow Website', severity: 'moderate', detail: `Load time ${wi.performance.loadTimeMs}ms — affects bounce rate`, detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'slow_site', label: 'Slow Website', severity: 'minor', detail: `Load time ${wi.performance.loadTimeMs}ms`, detected: false });
  }

  // Analytics from WebsiteIntelligence
  if (wi && wi.reachable && !wi.hasAnalytics) {
    gaps.push({ type: 'missing_analytics', label: 'Missing Analytics', severity: 'moderate', detail: 'No Google Analytics, Meta Pixel, or other tracking found', detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'missing_analytics', label: 'Missing Analytics', severity: 'minor', detail: `${wi.analyticsFound.length} analytics tool(s) detected`, detected: false });
  }

  // Chatbot from WebsiteIntelligence
  if (wi && wi.reachable && !wi.hasChatbot) {
    gaps.push({ type: 'missing_chatbot', label: 'No Live Chat', severity: 'moderate', detail: 'No chat widget detected — potential missed conversions', detected: true });
  } else if (wi && wi.reachable) {
    gaps.push({ type: 'missing_chatbot', label: 'No Live Chat', severity: 'minor', detail: `${wi.chatbotFound.length} chat solution(s) detected`, detected: false });
  }

  if (website.quality === 'none') {
    gaps.push({ type: 'no_website', label: 'No Website', severity: 'critical', detail: 'Business has no website at all', detected: true });
  } else if (website.quality === 'poor') {
    gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'moderate', detail: 'Website issues: ' + website.signals.join(', '), detected: true });
  } else {
    gaps.push({ type: 'poor_website', label: 'Poor Website', severity: 'minor', detail: 'Website looks solid', detected: false });
  }

  const reviewCount = countRealReviews(lead);
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

  const socialCount = countSocialProfiles(lead);
  if (socialCount === 0) {
    gaps.push({ type: 'no_social', label: 'No Social Presence', severity: 'critical', detail: 'No Facebook, Instagram, LinkedIn, TikTok, or YouTube profiles found', detected: true });
  } else {
    gaps.push({ type: 'no_social', label: 'No Social Presence', severity: 'minor', detail: `${socialCount} social profile(s) found`, detected: false });
  }

  const seoSignals = detectSeoSignals(lead);
  if (seoSignals.flags.length > 0) {
    gaps.push({
      type: 'no_seo',
      label: 'SEO Gaps',
      severity: seoSignals.flags.length > 2 ? 'critical' : 'moderate',
      detail: seoSignals.flags.join('; '),
      detected: true,
    });
  } else {
    gaps.push({ type: 'no_seo', label: 'SEO Gaps', severity: 'minor', detail: 'No obvious SEO gaps', detected: false });
  }

  const hasPhone = hasValue(lead.phone_number) || hasValue(lead.phone);
  if (!hasPhone) {
    gaps.push({ type: 'no_phone', label: 'No Phone Listed', severity: 'moderate', detail: 'Phone number is missing — potential lost calls', detected: true });
  } else {
    gaps.push({ type: 'no_phone', label: 'No Phone Listed', severity: 'minor', detail: 'Phone number present', detected: false });
  }

  const hasEmail = hasValue(lead.email) || (lead.emails !== undefined && lead.emails !== null && lead.emails.length > 0);
  if (!hasEmail) {
    gaps.push({ type: 'no_email', label: 'No Email Listed', severity: 'moderate', detail: 'Email address is missing', detected: true });
  } else {
    gaps.push({ type: 'no_email', label: 'No Email Listed', severity: 'minor', detail: 'Email present', detected: false });
  }

  return gaps;
}

function detectSeoSignals(lead: Lead): { flags: string[] } {
  const flags: string[] = [];
  const wi = lead.website_intelligence;

  if (wi && wi.reachable) {
    if (!wi.seo.hasTitle) flags.push('No <title> tag');
    if (!wi.seo.hasMetaDescription) flags.push('No meta description');
    if (!wi.seo.hasH1) flags.push('No H1 heading');
    if (wi.seo.hasMultipleH1) flags.push(`Multiple H1 tags (${wi.seo.headingStructure.h1})`);
    if (wi.seo.missingAltCount > 0) flags.push(`${wi.seo.missingAltCount} images missing alt text`);
    if (!wi.seo.hasCanonical) flags.push('No canonical tag');
    if (!wi.seo.hasStructuredData) flags.push('No structured data');
    if (!wi.hasViewportMeta) flags.push('Not mobile-responsive');
    if (wi.performance.loadTimeMs > 3000) flags.push('Slow load time (' + wi.performance.loadTimeMs + 'ms)');
    return { flags };
  }

  if (!hasValue(lead.description)) flags.push('No meta description/about text');
  const websiteQuality = assessWebsite(lead.website, wi);
  if (websiteQuality.quality === 'none') {
    flags.push('No website to optimize for search');
    return { flags };
  }
  if (websiteQuality.signals.length > 0) flags.push('Website quality issues impact SEO');
  const reviewCount = countRealReviews(lead);
  if (reviewCount < 5) flags.push('Low review count — limited local ranking signals');
  if (!lead.business_hours || Object.keys(lead.business_hours).length === 0) flags.push('No business hours — may lack structured data');
  if (!hasValue(lead.category)) flags.push('No category — weak topical relevance');
  else {
    const cat = lead.category.toLowerCase();
    if (cat.includes('general') || cat.includes('unspecified')) flags.push('Generic category signal');
  }
  return { flags };
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

function computeConversionProbability(lead: Lead, gaps: OpportunityGap[]): { probability: number; factors: ConversionFactor[] } {
  const factors: ConversionFactor[] = [];
  let score = 50;

  const hasPhone = hasValue(lead.phone_number) || hasValue(lead.phone);
  if (hasPhone) {
    score += 12;
    factors.push({ factor: 'Phone listed', impact: 'positive', reason: 'Accessible by phone — easier to contact', weight: 12 });
  } else {
    score -= 5;
    factors.push({ factor: 'No phone listed', impact: 'negative', reason: 'Harder to reach owner directly', weight: -5 });
  }

  const hasEmail = hasValue(lead.email) || (lead.emails !== undefined && lead.emails !== null && lead.emails.length > 0);
  if (hasEmail) {
    score += 10;
    factors.push({ factor: 'Email listed', impact: 'positive', reason: 'Direct email contact available', weight: 10 });
  } else {
    score -= 5;
    factors.push({ factor: 'No email listed', impact: 'negative', reason: 'No direct email channel', weight: -5 });
  }

  const reviewCount = countRealReviews(lead);
  if (reviewCount >= 20) {
    score += 8;
    factors.push({ factor: 'Established reputation', impact: 'positive', reason: reviewCount + ' reviews — business is active', weight: 8 });
  } else if (reviewCount >= 5) {
    factors.push({ factor: 'Some reviews', impact: 'neutral', reason: reviewCount + ' reviews — moderate engagement', weight: 0 });
  } else {
    score -= 8;
    factors.push({ factor: 'Few reviews', impact: 'negative', reason: reviewCount + ' reviews — low engagement signal', weight: -8 });
  }

  const rating = lead.rating;
  const minForRating = 3;
  if (rating !== null && rating !== undefined && reviewCount >= minForRating) {
    if (rating >= 4.5) {
      score += 10;
      factors.push({ factor: `High rating (${rating}/5)`, impact: 'positive', reason: 'Excellent reputation signals quality business', weight: 10 });
    } else if (rating <= 3.0) {
      score -= 8;
      factors.push({ factor: `Low rating (${rating}/5)`, impact: 'negative', reason: 'Below-average rating may indicate problems', weight: -8 });
    } else {
      factors.push({ factor: `Average rating (${rating}/5)`, impact: 'neutral', reason: 'Adequate reputation', weight: 0 });
    }
  } else {
    score -= 5;
    factors.push({ factor: 'No rating data', impact: 'negative', reason: 'Cannot assess quality signal', weight: -5 });
  }

  const detectedGaps = gaps.filter(g => g.detected);
  const gapCount = detectedGaps.length;
  if (gapCount >= 4) {
    score += 15;
    factors.push({ factor: gapCount + ' gaps detected', impact: 'positive', reason: 'Many pain points = higher budget receptiveness', weight: 15 });
  } else if (gapCount >= 2) {
    score += 8;
    factors.push({ factor: gapCount + ' gaps detected', impact: 'positive', reason: 'Multiple gaps increase engagement likelihood', weight: 8 });
  } else if (gapCount === 0) {
    score -= 10;
    factors.push({ factor: 'No gaps detected', impact: 'negative', reason: 'No obvious pain points', weight: -10 });
  } else {
    factors.push({ factor: gapCount + ' gap(s) detected', impact: 'neutral', reason: 'Moderate opportunity level', weight: 0 });
  }

  const socialCount = countSocialProfiles(lead);
  if (socialCount >= 2) {
    score += 5;
    factors.push({ factor: 'Active social presence', impact: 'positive', reason: socialCount + ' profiles — digitally engaged', weight: 5 });
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
  gaps: OpportunityGap[],
  lead: Lead,
  pricing: Record<string, number>
): { service: string; details: string; price: number } {
  const detected = gaps.filter(g => g.detected);
  const category = lead.category || 'local business';
  const industry = category.split(',').map(s => s.trim()).filter(Boolean).join(', ') || category;

  const hasNoWebsite = detected.some(g => g.type === 'no_website');
  const hasPoorWebsite = detected.some(g => g.type === 'poor_website');
  const hasLowReviews = detected.some(g => g.type === 'low_reviews');
  const hasNoSocial = detected.some(g => g.type === 'no_social');
  const hasSeoGaps = detected.some(g => g.type === 'no_seo');
  const gapCount = detected.length;

  if (hasNoWebsite) {
    const extra = hasSeoGaps ? ' with built-in SEO structure and local schema' : '';
    return { service: 'Website Build Package', details: `${lead.business_name} is a ${industry} business with no website. Build a mobile-responsive, SEO-optimized site${extra}.`, price: pricing.websiteBuild || 2500 };
  }

  if (hasPoorWebsite && hasSeoGaps) {
    return { service: 'Website Redesign + SEO Audit', details: `${lead.business_name} in ${industry} has an existing website with quality issues. Redesign with modern UX plus a full SEO audit and remediation.`, price: (pricing.websiteRedesign || 1800) + (pricing.seoAudit || 1200) };
  }

  if (hasSeoGaps && !hasPoorWebsite) {
    const isMonthly = gapCount >= 3;
    return {
      service: isMonthly ? 'SEO Monthly Retainer' : 'SEO Audit Package',
      details: `${lead.business_name} (${industry}) has SEO gaps. Deliver ${isMonthly ? 'monthly SEO management' : 'a one-time SEO audit with recommendations'}.`,
      price: isMonthly ? (pricing.seoMonthly || 800) : (pricing.seoAudit || 1200),
    };
  }

  if (hasNoSocial) {
    const bundled = gapCount > 2;
    return {
      service: bundled ? 'Social Media Setup + Management' : 'Social Media Setup Package',
      details: `${lead.business_name} in ${industry} has no social media presence. ${bundled ? 'Set up profiles plus 3 months management.' : 'Set up profiles on the most relevant platforms.'}`,
      price: (pricing.socialSetup || 600) + (bundled ? (pricing.socialManagement || 1500) : 0),
    };
  }

  if (hasPoorWebsite) {
    return { service: 'Website Redesign Package', details: `Existing website for ${lead.business_name} (${industry}) needs improvement. Redesign with modern templates and HTTPS.`, price: pricing.websiteRedesign || 1800 };
  }

  if (hasLowReviews) {
    return { service: 'Review Management Package', details: `${lead.business_name} in ${industry} can benefit from a review generation and management campaign to build social proof.`, price: pricing.reviewManagement || 500 };
  }

  if (gapCount === 1) {
    return { service: 'Local Citation Cleanup', details: `Minor gaps (${detected.map(g => g.label).join(', ')}) for ${lead.business_name}. A local citation cleanup improves discoverability.`, price: pricing.localCitation || 400 };
  }

  return { service: 'Full Digital Audit', details: `Comprehensive audit for ${lead.business_name} (${industry}) — ${gapCount} gaps found: ${detected.map(g => g.label).join(', ')}.`, price: pricing.fullDigitalAudit || 900 };
}

function computeDealValue(
  recommendation: { price: number; service: string },
  gaps: OpportunityGap[],
  lead: Lead,
  pricing: Record<string, number>
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

export function analyzeOpportunity(lead: Lead): Partial<Lead> {
  const settings = getSettings();
  const config = settings.opportunityConfig;
  const pricing = config.pricing as unknown as Record<string, number>;
  const thresholds = config.thresholds;

  const gaps = detectGaps(lead, thresholds);
  const recommendation = getServiceRecommendation(gaps, lead, pricing);
  const { value, breakdown } = computeDealValue(recommendation, gaps, lead, pricing);
  const { probability, factors } = computeConversionProbability(lead, gaps);

  const detectedCount = gaps.filter(g => g.detected).length;
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (detectedCount >= 3) confidence = 'high';
  else if (detectedCount <= 1) confidence = 'low';

  return {
    opportunity_gaps: gaps,
    recommended_service: recommendation.service,
    recommended_service_details: recommendation.details,
    estimated_deal_value: value,
    deal_value_breakdown: breakdown,
    conversion_probability: probability,
    conversion_factors: factors,
    opportunity_confidence: confidence,
  };
}