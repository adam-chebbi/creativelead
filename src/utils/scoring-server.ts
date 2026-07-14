import { createHash } from 'crypto';

export interface WebsiteIntelSignals {
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
  hasTitle: boolean | null;
  hasMetaDescription: boolean | null;
  hasStructuredData: boolean | null;
  missingAltCount: number | null;
  totalImgTags: number | null;
}

export interface ScoringInput {
  id: string;
  businessName: string | null | undefined;
  category: string | null | undefined;
  city: string | null | undefined;
  rating: number | null | undefined;
  reviewCount: number | null | undefined;
  website: string | null | undefined;
  socialLinksCount: number;
  websiteIntel: WebsiteIntelSignals | null | undefined;
}

export interface ComputedSubScores {
  opportunityScore: number;
  competitionScore: number;
  growthScore: number;
  seoWeakness: number;
  websiteQuality: number;
  reviewReputation: number;
  overallScore: number;
  classification: 'Hot' | 'Warm' | 'Cold';
  insufficientData: string[];
}

export interface ScoringResult extends ComputedSubScores {
  inputHash: string;
  opportunityNarrative: string | null;
  aiModelUsed: string | null;
}

const DEFAULT_WEIGHTS = {
  opportunity: 20,
  competition: 20,
  growth: 15,
  seo: 15,
  website: 15,
  reputation: 15,
};

export function hashScoringInputs(input: ScoringInput): string {
  const normalized = {
    id: input.id,
    rating: input.rating ?? null,
    reviewCount: input.reviewCount ?? null,
    website: input.website ?? null,
    category: input.category ?? null,
    city: input.city ?? null,
    socialLinksCount: input.socialLinksCount,
    wi: input.websiteIntel
      ? {
          reachable: input.websiteIntel.reachable,
          isHttps: input.websiteIntel.isHttps,
          hasViewportMeta: input.websiteIntel.hasViewportMeta,
          seoScore: input.websiteIntel.seoScore,
          performanceScore: input.websiteIntel.performanceScore,
          loadTimeMs: input.websiteIntel.loadTimeMs,
          hasAnalytics: input.websiteIntel.hasAnalytics,
          hasChatbot: input.websiteIntel.hasChatbot,
          hasTitle: input.websiteIntel.hasTitle,
          hasMetaDescription: input.websiteIntel.hasMetaDescription,
          hasStructuredData: input.websiteIntel.hasStructuredData,
        }
      : null,
  };
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);
}

export function computeWebsiteQuality(signals: WebsiteIntelSignals | null | undefined): { score: number; insufficient: boolean } {
  if (!signals || signals.reachable === false || signals.reachable === null) {
    return { score: 0, insufficient: !signals?.reachable };
  }

  let score = 0;
  const weights = {
    reachable: 10,
    https: 15,
    viewport: 10,
    title: 8,
    metaDescription: 8,
    structuredData: 10,
    altText: 7,
    loadTime: 15,
    analytics: 10,
    chatbot: 7,
  };

  if (signals.reachable === true) score += weights.reachable;

  if (signals.isHttps === true) score += weights.https;
  else if (signals.isHttps === false) score += Math.round(weights.https * 0.3);

  if (signals.hasViewportMeta === true) score += weights.viewport;

  if (signals.hasTitle === true) score += weights.title;

  if (signals.hasMetaDescription === true) score += weights.metaDescription;

  if (signals.hasStructuredData === true) score += weights.structuredData;

  if (signals.missingAltCount !== null && signals.totalImgTags !== null && signals.totalImgTags > 0) {
    const altRatio = 1 - (signals.missingAltCount / signals.totalImgTags);
    score += Math.round(weights.altText * altRatio);
  } else if (signals.totalImgTags === 0) {
    score += weights.altText;
  }

  if (signals.loadTimeMs !== null) {
    if (signals.loadTimeMs < 500) score += weights.loadTime;
    else if (signals.loadTimeMs < 1500) score += Math.round(weights.loadTime * 0.7);
    else if (signals.loadTimeMs < 3000) score += Math.round(weights.loadTime * 0.4);
    else if (signals.loadTimeMs < 5000) score += Math.round(weights.loadTime * 0.2);
  }

  if (signals.hasAnalytics === true) score += weights.analytics;

  if (signals.hasChatbot === true) score += weights.chatbot;

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    insufficient: false,
  };
}

export function computeReviewReputation(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
): { score: number; insufficient: boolean } {
  if (rating === null || rating === undefined || rating <= 0) {
    return { score: 0, insufficient: true };
  }

  let score = (rating / 5) * 100;

  const count = reviewCount ?? 0;
  if (count < 5) score *= 0.5;
  else if (count < 10) score *= 0.7;
  else if (count < 30) score *= 0.85;

  return { score: Math.round(score), insufficient: false };
}

export function computeCompetitionScore(reviewCount: number | null | undefined): { score: number; insufficient: boolean } {
  if (reviewCount === null || reviewCount === undefined) {
    return { score: 50, insufficient: true };
  }
  return { score: Math.min(100, Math.round((reviewCount / 500) * 100)), insufficient: false };
}

export function computeGrowthScore(
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
  competitionScore: number,
): { score: number; insufficient: boolean } {
  let score = 100 - competitionScore;

  if (rating !== null && rating !== undefined && rating > 0) {
    if (rating > 4.5 && (reviewCount ?? 0) < 50) score += 20;
    else if (rating > 4.0) score += 10;
    else if (rating < 3.0) score -= 15;
  }

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    insufficient: competitionScore === 50 && (rating === null || rating === undefined || rating <= 0),
  };
}

export function computeSeoWeakness(
  website: string | null | undefined,
  rating: number | null | undefined,
  reviewCount: number | null | undefined,
  signals: WebsiteIntelSignals | null | undefined,
): { score: number; insufficient: boolean } {
  let score = 0;
  const hasWebsite = !!website;

  if (!hasWebsite) {
    score += 50;
  }

  if (rating === null || rating === undefined || rating <= 0) {
    score += 25;
  } else if (rating < 4.0) {
    score += 25;
  }

  if (reviewCount === null || reviewCount === undefined) {
    score += 25;
  } else if (reviewCount < 20) {
    score += 25;
  }

  if (hasWebsite && signals) {
    if (!signals.hasTitle) score += 10;
    if (!signals.hasMetaDescription) score += 10;
    if (!signals.hasStructuredData) score += 10;
    if (signals.loadTimeMs !== null && signals.loadTimeMs > 3000) score += 10;
  }

  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    insufficient: false,
  };
}

export function computeOpportunityScore(
  seoWeakness: number,
  websiteQuality: number,
): { score: number; insufficient: boolean } {
  const score = seoWeakness * 0.6 + (100 - websiteQuality) * 0.4;
  return {
    score: Math.round(Math.min(100, Math.max(0, score))),
    insufficient: false,
  };
}

export function computeClassification(overall: number): 'Hot' | 'Warm' | 'Cold' {
  if (overall >= 75) return 'Hot';
  if (overall >= 40) return 'Warm';
  return 'Cold';
}

export function computeScores(input: ScoringInput, weights?: typeof DEFAULT_WEIGHTS): ComputedSubScores {
  const w = weights ?? DEFAULT_WEIGHTS;

  const websiteQuality = computeWebsiteQuality(input.websiteIntel);
  const reviewReputation = computeReviewReputation(input.rating, input.reviewCount);
  const competition = computeCompetitionScore(input.reviewCount);
  const growth = computeGrowthScore(input.rating, input.reviewCount, competition.score);
  const seoWeakness = computeSeoWeakness(input.website, input.rating, input.reviewCount, input.websiteIntel);
  const opportunity = computeOpportunityScore(seoWeakness.score, websiteQuality.score);

  const insufficientData: string[] = [];
  if (websiteQuality.insufficient) insufficientData.push('website_quality');
  if (reviewReputation.insufficient) insufficientData.push('review_reputation');
  if (competition.insufficient) insufficientData.push('competition');
  if (growth.insufficient) insufficientData.push('growth');

  const totalWeight = w.opportunity + w.competition + w.growth + w.seo + w.website + w.reputation;
  const weightFactor = totalWeight > 0 ? totalWeight : 1;

  let overallScore =
    (opportunity.score * (w.opportunity / weightFactor)) +
    ((100 - competition.score) * (w.competition / weightFactor)) +
    (growth.score * (w.growth / weightFactor)) +
    ((100 - seoWeakness.score) * (w.seo / weightFactor)) +
    (websiteQuality.score * (w.website / weightFactor)) +
    (reviewReputation.score * (w.reputation / weightFactor));

  overallScore = Math.round(Math.min(100, Math.max(0, overallScore)));

  return {
    opportunityScore: opportunity.score,
    competitionScore: competition.score,
    growthScore: growth.score,
    seoWeakness: seoWeakness.score,
    websiteQuality: websiteQuality.score,
    reviewReputation: reviewReputation.score,
    overallScore,
    classification: computeClassification(overallScore),
    insufficientData,
  };
}

export async function callAiForOpportunityNarrative(
  input: ScoringInput,
  subScores: ComputedSubScores,
  aiCallFn: (prompt: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>,
): Promise<string | null> {
  const hasRealData = input.rating || input.reviewCount || input.website;
  if (!hasRealData) return null;

  const prompt = `You are a business opportunity analyst. Based on the following data about a business, produce a short qualitative opportunity narrative (2-4 sentences).

## Business Profile
- Name: ${input.businessName || 'Unknown'}
- Category: ${input.category || 'Unknown'}
- City: ${input.city || 'Unknown'}
- Rating: ${input.rating ?? 'Not available'}/5
- Review Count: ${input.reviewCount ?? 'Not available'}
- Has Website: ${!!input.website}
- Social Links Found: ${input.socialLinksCount}

## Computed Sub-Scores (0-100)
- Website Quality: ${subScores.websiteQuality}
- Review Reputation: ${subScores.reviewReputation}
- Competition Score: ${subScores.competitionScore}
- Growth Potential: ${subScores.growthScore}
- SEO Weakness: ${subScores.seoWeakness}
- Opportunity Score: ${subScores.opportunityScore}
- Overall AI Score: ${subScores.overallScore}

## Insufficient Data Flags
${subScores.insufficientData.length > 0 ? subScores.insufficientData.map(f => `- ${f}: insufficient data`).join('\n') : '- All signals present'}

## Instructions
Write a concise opportunity narrative (2-4 sentences) that:
1. Identifies the single biggest opportunity or risk for this business
2. Mentions what specific action would improve their score most
3. Notes any critical data gaps that limit the analysis

CRITICAL RULES:
- Use ONLY the values provided above. Do NOT invent or assume a rating, review count, or revenue figure that was not given.
- If a field says "Not available" or "insufficient data", explicitly state that it is unknown rather than guessing.
- Be specific about numbers where available, but do not fabricate any.
- Return ONLY the narrative text — no JSON, no markdown formatting, no preamble.`;

  try {
    const result = await aiCallFn(prompt);
    if (result.ok) {
      return result.text.trim();
    }
    return null;
  } catch {
    return null;
  }
}
