import { prisma } from '@/lib/prisma';
import { computeScores, hashScoringInputs, callAiForOpportunityNarrative, ScoringInput, WebsiteIntelSignals, ScoringResult } from './scoring-server';

export interface AiCallConfig {
  provider: string;
  model: string;
  apiKey: string;
  apiBase?: string;
}

function countSocialLinks(lead: {
  linkedinUrl?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  youtubeUrl?: string | null;
}): number {
  let count = 0;
  if (lead.linkedinUrl) count++;
  if (lead.facebookUrl) count++;
  if (lead.instagramUrl) count++;
  if (lead.tiktokUrl) count++;
  if (lead.youtubeUrl) count++;
  return count;
}

function buildWebsiteIntelSignals(lead: any): WebsiteIntelSignals | null {
  const wi = lead.websiteIntel;
  if (!wi) return null;
  return {
    reachable: wi.reachable ?? null,
    isHttps: wi.isHttps ?? null,
    hasViewportMeta: wi.hasViewportMeta ?? null,
    seoScore: wi.seoScore ?? null,
    performanceScore: wi.performanceScore ?? null,
    loadTimeMs: wi.loadTimeMs ?? null,
    hasAnalytics: wi.hasAnalytics ?? null,
    analyticsTools: wi.analyticsTools ?? [],
    hasChatbot: wi.hasChatbot ?? null,
    chatbotTools: wi.chatbotTools ?? [],
    hasTitle: wi.hasTitle ?? null,
    hasMetaDescription: wi.hasMetaDescription ?? null,
    hasStructuredData: wi.hasStructuredData ?? null,
    missingAltCount: wi.missingAltCount ?? null,
    totalImgTags: wi.totalImgTags ?? null,
  };
}

export async function getScoringInputFromDb(leadId: string, workspaceId: string): Promise<ScoringInput | null> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, workspaceId: workspaceId },
    include: {
      enrichment: true,
      websiteIntel: true,
    },
  });

  if (!lead) return null;

  const enrichment = lead.enrichment;

  return {
    id: lead.id,
    businessName: lead.businessName,
    category: lead.category,
    city: lead.city,
    rating: lead.rating,
    reviewCount: lead.reviewCount,
    website: lead.website,
    socialLinksCount: enrichment ? countSocialLinks(enrichment) : 0,
    websiteIntel: buildWebsiteIntelSignals(lead),
  };
}

export async function scoreLead(
  leadId: string,
  workspaceId: string,
  aiConfig?: AiCallConfig,
): Promise<ScoringResult | null> {
  const input = await getScoringInputFromDb(leadId, workspaceId);
  if (!input) return null;

  const subScores = computeScores(input);

  const inputHash = hashScoringInputs(input);

  let opportunityNarrative: string | null = null;

  if (aiConfig && aiConfig.apiKey) {
    opportunityNarrative = await callAiForOpportunityNarrative(input, subScores, async (prompt) => {
      try {
        const baseUrl = aiConfig.apiBase || 'https://api.openai.com/v1';
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: aiConfig.model || 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a business opportunity analyst. Respond only with the narrative text, no formatting.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 300,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          console.error('[scoreLead] AI API error:', res.status, errBody.slice(0, 200));
          return { ok: false, error: `API error ${res.status}` };
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) return { ok: false, error: 'Empty response' };
        return { ok: true, text: text.trim() };
      } catch (err) {
        console.error('[scoreLead] AI call error:', err);
        return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
      }
    });
  }

  const result: ScoringResult = {
    ...subScores,
    inputHash,
    opportunityNarrative,
    aiModelUsed: aiConfig ? `${aiConfig.provider}/${aiConfig.model}` : null,
  };

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      aiScore: result.overallScore,
      classification: result.classification,
      opportunityScore: result.opportunityScore,
      competitionScore: result.competitionScore,
      growthScore: result.growthScore,
      seoWeakness: result.seoWeakness,
      websiteQuality: result.websiteQuality,
      reviewReputation: result.reviewReputation,
      aiScoreLastComputed: new Date(),
      aiScoreInputsHash: result.inputHash,
    },
  });

  if (opportunityNarrative || result.overallScore > 0) {
    await prisma.leadOpportunity.upsert({
      where: { leadId },
      create: {
        leadId,
        conversionProbability: result.overallScore / 100,
        recommendedService: null,
        detectedGaps: result.insufficientData.length > 0 ? result.insufficientData.map(f => ({
          type: 'insufficient_data',
          label: `Insufficient data: ${f}`,
          severity: 'moderate',
          detail: `Missing data for ${f} — score may not reflect true potential`,
          detected: true,
        })) : [],
      },
      update: {
        conversionProbability: result.overallScore / 100,
      },
    });
  }

  return result;
}

export async function scoreLeadById(
  leadId: string,
  workspaceId: string,
): Promise<ScoringResult | null> {
  const input = await getScoringInputFromDb(leadId, workspaceId);
  if (!input) return null;

  const subScores = computeScores(input);
  const inputHash = hashScoringInputs(input);

  const result: ScoringResult = {
    ...subScores,
    inputHash,
    opportunityNarrative: null,
    aiModelUsed: null,
  };

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      aiScore: result.overallScore,
      classification: result.classification,
      opportunityScore: result.opportunityScore,
      competitionScore: result.competitionScore,
      growthScore: result.growthScore,
      seoWeakness: result.seoWeakness,
      websiteQuality: result.websiteQuality,
      reviewReputation: result.reviewReputation,
      aiScoreLastComputed: new Date(),
      aiScoreInputsHash: result.inputHash,
    },
  });

  return result;
}

export function shouldRescoreOnUpdate(
  oldData: { rating?: number | null; reviewCount?: number | null; website?: string | null; category?: string | null; city?: string | null },
  newData: { rating?: number | null; reviewCount?: number | null; website?: string | null; category?: string | null; city?: string | null },
): boolean {
  const fields: (keyof typeof oldData)[] = ['rating', 'reviewCount', 'website', 'category', 'city'];
  for (const field of fields) {
    if (newData[field] !== undefined && newData[field] !== oldData[field]) return true;
  }
  return false;
}

interface ImportValidationReport {
  totalRows: number;
  rowsWithRating: number;
  rowsWithReviewCount: number;
  rowsWithRatingButNull: { index: number; businessName: string; sourceRating: number }[];
  rowsWithReviewCountButNull: { index: number; businessName: string; sourceReviewCount: number }[];
  rowsWithMissingRating: number;
  rowsWithMissingReviewCount: number;
}

export function generateImportReport(
  sourceData: { business_name: string; rating?: number | null; review_count?: number | null }[],
  createdResults: { status: string; value?: { rating?: number | null; reviewCount?: number | null; businessName?: string | null }; reason?: any }[],
): ImportValidationReport {
  const report: ImportValidationReport = {
    totalRows: sourceData.length,
    rowsWithRating: 0,
    rowsWithReviewCount: 0,
    rowsWithRatingButNull: [],
    rowsWithReviewCountButNull: [],
    rowsWithMissingRating: 0,
    rowsWithMissingReviewCount: 0,
  };

  for (let i = 0; i < sourceData.length; i++) {
    const src = sourceData[i];
    const result = createdResults[i];

    if (src.rating !== null && src.rating !== undefined) {
      report.rowsWithRating++;
      if (result?.status === 'fulfilled' && (result.value?.rating === null || result.value?.rating === undefined)) {
        report.rowsWithRatingButNull.push({
          index: i,
          businessName: src.business_name,
          sourceRating: src.rating,
        });
      }
    } else {
      report.rowsWithMissingRating++;
    }

    if (src.review_count !== null && src.review_count !== undefined) {
      report.rowsWithReviewCount++;
      if (result?.status === 'fulfilled' && (result.value?.reviewCount === null || result.value?.reviewCount === undefined)) {
        report.rowsWithReviewCountButNull.push({
          index: i,
          businessName: src.business_name,
          sourceReviewCount: src.review_count,
        });
      }
    } else {
      report.rowsWithMissingReviewCount++;
    }
  }

  return report;
}
