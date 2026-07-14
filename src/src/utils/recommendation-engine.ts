import { Lead, PipelineStage, OpportunityGap } from '../types';
import { generateAIScores } from './scoring';
import {
  RankedLead, SimilarCompany, NearbyOpportunity, MarketGap,
  SmartFilterResult, SmartFilterKey, SMART_FILTER_DEFS,
  RecommendationEngineResult, hasActiveGap
} from './recommendation-types';

const EARTH_RADIUS_KM = 6371;

function deg2rad(deg: number): number { return deg * (Math.PI / 180); }

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlat = deg2rad(lat2 - lat1);
  const dlon = deg2rad(lon2 - lon1);
  const a = Math.sin(dlat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dlon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_KM * c * 10) / 10;
}

function categoryTokenize(cat: string | null | undefined): string[] {
  if (!cat) return [];
  return cat.toLowerCase().split(/[,/&]+/).map(s => s.trim()).filter(Boolean);
}

function getSocialProfiles(lead: Lead): number {
  let count = 0;
  for (const field of ['facebook', 'instagram', 'linkedin', 'tiktok', 'youtube'] as const) {
    if (lead[field] && typeof lead[field] === 'string' && (lead[field] as string).trim().length > 0) count++;
  }
  if (lead.social_profiles) count += lead.social_profiles.length;
  return count;
}

function countRealReviews(lead: Lead): number {
  let count = lead.review_count || 0;
  if (lead.reviews && lead.reviews.length > 0) {
    const real = lead.reviews.filter(r =>
      (r.reviewer_name ?? '').trim().length > 0 || (r.review_text ?? '').trim().length > 0
    );
    count = Math.max(count, real.length);
  }
  return count;
}

function hasWebsite(lead: Lead): boolean {
  return !!(lead.website && lead.website.trim().length > 0);
}

function isActive(stage: string | undefined | null): boolean {
  return !stage || (stage !== 'won' && stage !== 'lost');
}

function cityMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

function getSeCategories(leads: Lead[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of leads) {
    const tokens = categoryTokenize(l.category);
    for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
  }
  return map;
}

function getCityCategoryMap(leads: Lead[]): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const lead of leads) {
    const city = (lead.city || '').toLowerCase().trim();
    if (!city) continue;
    if (!map.has(city)) map.set(city, new Map());
    const catMap = map.get(city)!;
    const tokens = categoryTokenize(lead.category);
    for (const t of tokens) catMap.set(t, (catMap.get(t) || 0) + 1);
  }
  return map;
}

function computeRankScore(lead: Lead, now: number): number {
  let score = 0;

  const scores = generateAIScores(lead);
  const aiScore = scores.ai_score || 0;
  score += aiScore * 0.45;

  const conversionProb = lead.conversion_probability ?? 50;
  score += conversionProb * 0.20;

  const dealValue = lead.estimated_deal_value ?? 0;
  const valueScore = Math.min(100, (dealValue / 10000) * 100);
  score += valueScore * 0.15;

  const enteredAt = lead._stageEnteredAt ? new Date(lead._stageEnteredAt).getTime() : 0;
  if (enteredAt > 0) {
    const daysSinceEntry = (now - enteredAt) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 100 - daysSinceEntry * 5);
    score += recencyScore * 0.10;
  }

  const detectedGaps = (lead.opportunity_gaps || []).filter(g => g.detected).length;
  const gapScore = Math.min(100, detectedGaps * 15);
  score += gapScore * 0.10;

  return Math.round(score);
}

export function computeRecommendations(leads: Lead[], referenceLeadUrl?: string): RecommendationEngineResult {
  const now = Date.now();
  const totalLeads = leads.length;

  // Stats
  const leadsWithScore = leads.filter(l => generateAIScores(l).ai_score != null).length;
  const leadsWithCoordinates = leads.filter(l => l.latitude != null && l.longitude != null).length;
  const leadsWithWebsite = leads.filter(hasWebsite).length;
  const leadsWithDealValue = leads.filter(l => (l.estimated_deal_value ?? 0) > 0).length;

  // ---- 1. Ranked Leads ----
  const scoredLeads = leads.map(l => ({
    lead: l,
    score: isActive(l._stage) ? computeRankScore(l, now) : computeRankScore(l, now) * 0.3,
  }));
  scoredLeads.sort((a, b) => b.score - a.score);

  const rankedLeads: RankedLead[] = scoredLeads.map(({ lead, score }, i) => {
    const parts: string[] = [];
    const scores = generateAIScores(lead);
    parts.push(`AI Score ${scores.ai_score ?? 'N/A'}`);
    if (lead.conversion_probability != null) parts.push(`conversion ${lead.conversion_probability}%`);
    if (lead.estimated_deal_value) parts.push(`$${lead.estimated_deal_value.toLocaleString()}`);
    const gaps = (lead.opportunity_gaps || []).filter(g => g.detected).length;
    if (gaps > 0) parts.push(`${gaps} gap(s)`);
    if (lead._stage === 'won' || lead._stage === 'lost') parts.push('deprioritized — closed');
    const daysInStage = lead._stageEnteredAt ? Math.floor((now - new Date(lead._stageEnteredAt).getTime()) / 86400000) : 0;
    if (daysInStage > 0 && daysInStage < 30) parts.push(`in stage ${daysInStage}d`);
    return {
      lead,
      rank: i + 1,
      score,
      explanation: `Ranked #${i + 1}: ${parts.join(', ')}`,
    };
  });

  // ---- 2. Similar Companies ----
  let similarCompanies: SimilarCompany[] | { empty: true; reason: string } = { empty: true, reason: 'Select a lead to find similar companies' };
  if (referenceLeadUrl) {
    const sourceLead = leads.find(l => l.google_maps_url === referenceLeadUrl);
    if (!sourceLead) {
      similarCompanies = { empty: true, reason: 'Reference lead not found in dataset' };
    } else {
      const refCats = categoryTokenize(sourceLead.category);
      const refCity = sourceLead.city;
      const refLat = sourceLead.latitude;
      const refLon = sourceLead.longitude;
      const refRating = sourceLead.rating ?? 0;
      const refUrl = sourceLead.google_maps_url;

      const scoredSimilar: { lead: Lead; score: number; sharedCat: boolean; sharedCity: boolean; dist: number | null; ratingDiff: number }[] = [];

      for (const other of leads) {
        if (other.google_maps_url === refUrl) continue;
        let simScore = 0;
        const otherCats = categoryTokenize(other.category);
        const sharedCat = refCats.some((t: string) => otherCats.includes(t));
        const sharedCityBool = cityMatch(refCity, other.city);
        const dist = (refLat != null && refLon != null && other.latitude != null && other.longitude != null)
          ? haversineDistance(refLat, refLon, other.latitude!, other.longitude!) : null;
        const ratingDiff = Math.abs(refRating - (other.rating ?? 0));

        if (sharedCat) simScore += 40;
        if (sharedCityBool) simScore += 30;
        if (dist != null && dist < 10) simScore += 20;
        else if (dist != null && dist < 50) simScore += 10;
        if (refRating > 0 && ratingDiff < 1.0) simScore += 10;

        if (simScore > 0) {
          scoredSimilar.push({ lead: other, score: simScore, sharedCat, sharedCity: sharedCityBool, dist, ratingDiff });
        }
      }

      scoredSimilar.sort((a, b) => b.score - a.score);
      const topSimilar = scoredSimilar.slice(0, 10);

      if (topSimilar.length === 0) {
        similarCompanies = { empty: true, reason: `No other imported leads match "${sourceLead.business_name}" — try importing more leads in this category or city.` };
      } else {
        similarCompanies = topSimilar.map(s => ({
          lead: s.lead,
          similarityScore: s.score,
          sharedCategory: s.sharedCat,
          sharedCity: s.sharedCity,
          distanceKm: s.dist,
          ratingDiff: Math.round(s.ratingDiff * 10) / 10,
          explanation: `Similarity ${s.score}/100: ${s.sharedCat ? 'same category' : 'different category'}${s.sharedCity ? ', same city' : ''}${s.dist != null ? `, ${s.dist} km` : ''}${s.ratingDiff < 1 ? ', similar rating' : ''}`,
        }));
      }
    }
  }

  // ---- 3. Nearby Opportunities ----
  let nearbyOpportunities: NearbyOpportunity[] | { empty: true; reason: string };
  const leadsWithCoords = leads.filter(l => l.latitude != null && l.longitude != null);
  if (leadsWithCoords.length < 2) {
    nearbyOpportunities = { empty: true, reason: `Only ${leadsWithCoords.length} lead(s) have coordinates. Import leads with coordinate data to enable proximity search.` };
  } else {
    const refLead = referenceLeadUrl
      ? leads.find(l => l.google_maps_url === referenceLeadUrl)
      : leadsWithCoords[0];
    if (!refLead || refLead.latitude == null || refLead.longitude == null) {
      nearbyOpportunities = { empty: true, reason: referenceLeadUrl ? 'Selected lead has no coordinates.' : 'No lead with coordinates found to use as reference.' };
    } else {
      const refLat = refLead.latitude;
      const refLon = refLead.longitude;
      const distanced = leadsWithCoords
        .filter(l => l.google_maps_url !== refLead.google_maps_url)
        .map(l => ({
          lead: l,
          distance: haversineDistance(refLat, refLon, l.latitude!, l.longitude!),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 15);

      if (distanced.length === 0) {
        nearbyOpportunities = { empty: true, reason: 'No other leads with coordinates found near the reference point.' };
      } else {
        nearbyOpportunities = distanced.map(d => ({
          lead: d.lead,
          distanceKm: d.distance,
          explanation: `${d.distance} km from ${refLead.business_name} — ${d.lead.city || d.lead.address || 'nearby area'}`,
        }));
      }
    }
  }

  // ---- 4. Market Gap Opportunities ----
  let marketGaps: MarketGap[] | { empty: true; reason: string };
  const cities = new Set(leads.filter(l => l.city).map(l => l.city!.toLowerCase().trim()));
  const allCategories = getSeCategories(leads);
  const cityCategoryCounts = getCityCategoryMap(leads);
  const gapResults: MarketGap[] = [];

  if (cities.size === 0 || allCategories.size === 0) {
    marketGaps = { empty: true, reason: 'Not enough category or city data. Import leads with category and city fields.' };
  } else {
    for (const city of Array.from(cities)) {
      const leadsInCity = leads.filter(l => l.city && l.city.toLowerCase().trim() === city);
      if (leadsInCity.length < 3) continue;

      const catMap = cityCategoryCounts.get(city);
      if (!catMap) continue;

      for (const [catName, count] of Array.from(catMap.entries())) {
        if (count > 1) continue;
        const leadsInCatGlobally = leads.filter(l => {
          const tokens = categoryTokenize(l.category);
          return tokens.includes(catName);
        });
        if (leadsInCatGlobally.length < 2) continue;

        const avgRating = leadsInCatGlobally.reduce((s, l) => s + (l.rating ?? 0), 0) / leadsInCatGlobally.length;
        const avgReviews = leadsInCatGlobally.reduce((s, l) => s + (l.review_count ?? 0), 0) / leadsInCatGlobally.length;
        const avgValue = leadsInCatGlobally.reduce((s, l) => s + (l.estimated_deal_value ?? 0), 0) / leadsInCatGlobally.length;

        if (avgRating >= 3.5 && avgReviews >= 10) {
          gapResults.push({
            category: catName,
            city: city.charAt(0).toUpperCase() + city.slice(1),
            leadCount: count,
            avgRating: Math.round(avgRating * 10) / 10,
            avgReviewCount: Math.round(avgReviews),
            avgDealValue: Math.round(avgValue),
            explanation: `Only ${count} ${catName} lead(s) in ${city}, but similar businesses elsewhere average ${avgRating}/5 with ${Math.round(avgReviews)} reviews — suggests underserved demand (avg deal $${Math.round(avgValue).toLocaleString()}).`,
          });
        }
      }
    }

    gapResults.sort((a, b) => b.avgReviewCount - a.avgReviewCount);

    if (gapResults.length === 0) {
      marketGaps = { empty: true, reason: 'No underserved categories detected. Import more leads from different categories or cities.' };
    } else {
      marketGaps = gapResults.slice(0, 8);
    }
  }

  // ---- 5. High-Conversion Predictions ----
  const conversionSorted = leads
    .filter(l => l.conversion_probability != null)
    .sort((a, b) => (b.conversion_probability ?? 0) - (a.conversion_probability ?? 0))
    .slice(0, 10);
  const highConversionLeads: RankedLead[] = conversionSorted.map((l, i) => ({
    lead: l,
    rank: i + 1,
    score: l.conversion_probability ?? 0,
    explanation: `Conversion probability ${l.conversion_probability}% — ${(l.opportunity_gaps || []).filter(g => g.detected).length} gap(s), phone/email/rating/review factors. ${l.estimated_deal_value ? `Est. value $${l.estimated_deal_value.toLocaleString()}.` : ''}`,
  }));

  // ---- 6. Smart Filters ----
  const smartFilters: SmartFilterResult[] = SMART_FILTER_DEFS.map(def => {
    let filtered: Lead[] = [];

    switch (def.key) {
      case 'highest_revenue':
        filtered = [...leads].filter(l => (l.estimated_deal_value ?? 0) > 0);
        filtered.sort((a, b) => (b.estimated_deal_value ?? 0) - (a.estimated_deal_value ?? 0));
        break;
      case 'weak_online':
        filtered = leads.filter(l => {
          const noWeb = !hasWebsite(l);
          const socCount = getSocialProfiles(l);
          const gaps = l.opportunity_gaps || [];
          const hasNoWebGap = gaps.some(g => g.type === 'no_website' && g.detected);
          const hasPoorWeb = gaps.some(g => g.type === 'poor_website' && g.detected);
          return (noWeb || hasNoWebGap || hasPoorWeb) && socCount === 0;
        });
        filtered.sort((a, b) => (b.opportunity_gaps || []).filter(g => g.detected).length - (a.opportunity_gaps || []).filter(g => g.detected).length);
        break;
      case 'no_website':
        filtered = leads.filter(l => !hasWebsite(l));
        break;
      case 'low_reviews':
        filtered = leads.filter(l => countRealReviews(l) < 10);
        filtered.sort((a, b) => countRealReviews(a) - countRealReviews(b));
        break;
      case 'no_seo':
        filtered = leads.filter(l => hasActiveGap(l, 'no_seo'));
        filtered.sort((a, b) => (b.opportunity_gaps || []).filter(g => g.type === 'no_seo' && g.detected).length - (a.opportunity_gaps || []).filter(g => g.type === 'no_seo' && g.detected).length);
        break;
    }

    const ranked: RankedLead[] = filtered.slice(0, 25).map((l, i) => {
      let explanation = `#${i + 1}: `;
      switch (def.key) {
        case 'highest_revenue': explanation += `Est. deal value $${(l.estimated_deal_value ?? 0).toLocaleString()}`; break;
        case 'weak_online': explanation += `${(l.opportunity_gaps || []).filter(g => g.detected).length} gap(s), ${getSocialProfiles(l)} social profile(s)`; break;
        case 'no_website': explanation += `No website URL detected`; break;
        case 'low_reviews': explanation += `${countRealReviews(l)} real reviews`; break;
        case 'no_seo': explanation += `SEO: ${(l.opportunity_gaps || []).filter(g => g.type === 'no_seo' && g.detected).map(g => g.detail).join('; ')}`; break;
      }
      const ai = generateAIScores(l);
      if (ai.ai_score != null) explanation += ` · AI Score ${ai.ai_score}`;
      return { lead: l, rank: i + 1, score: 0, explanation };
    });

    return { label: def.label, filterKey: def.key, leads: ranked, active: false, count: filtered.length };
  });

  return {
    rankedLeads,
    similarCompanies,
    nearbyOpportunities,
    marketGaps,
    highConversionLeads,
    smartFilters,
    stats: {
      totalLeads,
      leadsWithScore,
      leadsWithCoordinates,
      leadsWithWebsite: leadsWithWebsite,
      leadsWithDealValue,
    },
  };
}