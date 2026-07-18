import { prisma } from '@/lib/prisma';

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

function cityMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.toLowerCase().trim() === b.toLowerCase().trim();
}

function isActive(stage: string | null | undefined): boolean {
  return !stage || (stage !== 'won' && stage !== 'lost');
}

function countSocialProfiles(lead: {
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

interface LeadRow {
  id: string;
  businessName: string;
  category: string | null;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  aiScore: number | null;
  classification: string | null;
  pipelineStage: string | null;
  createdAt: Date;
  updatedAt: Date;
  opportunityScore: number | null;
  competitionScore: number | null;
  growthScore: number | null;
  seoWeakness: number | null;
  websiteQuality: number | null;
  reviewReputation: number | null;
  enrichment: {
    linkedinUrl: string | null;
    facebookUrl: string | null;
    instagramUrl: string | null;
    tiktokUrl: string | null;
    youtubeUrl: string | null;
  } | null;
  opportunity: {
    detectedGaps: any;
    estimatedDealValue: number | null;
    conversionProbability: number | null;
  } | null;
}

async function getLeads(workspaceId: string): Promise<LeadRow[]> {
  const leads = await prisma.lead.findMany({
    where: { workspaceId: workspaceId },
    include: {
      enrichment: { select: { linkedinUrl: true, facebookUrl: true, instagramUrl: true, tiktokUrl: true, youtubeUrl: true } },
      opportunity: { select: { detectedGaps: true, estimatedDealValue: true, conversionProbability: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return leads.map(l => ({
    id: l.id,
    businessName: l.businessName,
    category: l.category,
    city: l.city,
    rating: l.rating,
    reviewCount: l.reviewCount,
    website: l.website,
    phone: l.phone,
    email: l.email,
    latitude: l.latitude,
    longitude: l.longitude,
    aiScore: l.aiScore,
    classification: l.classification,
    pipelineStage: l.pipelineStage,
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
    opportunityScore: l.opportunityScore,
    competitionScore: l.competitionScore,
    growthScore: l.growthScore,
    seoWeakness: l.seoWeakness,
    websiteQuality: l.websiteQuality,
    reviewReputation: l.reviewReputation,
    enrichment: l.enrichment,
    opportunity: l.opportunity,
  }));
}

function getDetectedGaps(lead: LeadRow): any[] {
  const gaps = lead.opportunity?.detectedGaps;
  if (!gaps || !Array.isArray(gaps)) return [];
  return gaps;
}

function countGaps(lead: LeadRow): number {
  return getDetectedGaps(lead).filter((g: any) => g.detected).length;
}

function hasActiveGap(lead: LeadRow, gapType: string): boolean {
  return getDetectedGaps(lead).some((g: any) => g.type === gapType && g.detected);
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

export interface RecommendationsResult {
  computedAt: string;
  rankedLeads: {
    id: string;
    businessName: string;
    category: string | null;
    city: string | null;
    rating: number | null;
    reviewCount: number | null;
    website: string | null;
    aiScore: number | null;
    pipelineStage: string | null;
    conversionProbability: number | null;
    estimatedDealValue: number | null;
    gapCount: number;
    score: number;
    explanation: string;
  }[];
  similarCompanies: {
    id: string;
    businessName: string;
    category: string | null;
    city: string | null;
    rating: number | null;
    similarityScore: number;
    sharedCategory: boolean;
    sharedCity: boolean;
    distanceKm: number | null;
    explanation: string;
  }[] | { empty: true; reason: string };
  nearbyOpportunities: {
    id: string;
    businessName: string;
    category: string | null;
    city: string | null;
    distanceKm: number;
    explanation: string;
  }[] | { empty: true; reason: string };
  marketGaps: {
    category: string;
    city: string;
    leadCount: number;
    avgRating: number;
    avgReviewCount: number;
    avgDealValue: number;
    explanation: string;
  }[] | { empty: true; reason: string };
  highConversionLeads: {
    id: string;
    businessName: string;
    category: string | null;
    city: string | null;
    conversionProbability: number | null;
    gapCount: number;
    estimatedDealValue: number | null;
    explanation: string;
  }[];
  smartFilters: {
    label: string;
    filterKey: string;
    count: number;
    leads: { id: string; businessName: string; category: string | null; city: string | null; explanation: string }[];
  }[];
  stats: {
    totalLeads: number;
    leadsWithScore: number;
    leadsWithCoordinates: number;
    leadsWithWebsite: number;
    leadsWithDealValue: number;
  };
}

export async function computeRecommendations(
  workspaceId: string,
  referenceLeadId?: string,
): Promise<RecommendationsResult> {
  const leads = await getLeads(workspaceId);
  const now = Date.now();
  const computedAt = new Date().toISOString();

  const stats = {
    totalLeads: leads.length,
    leadsWithScore: leads.filter(l => l.aiScore != null).length,
    leadsWithCoordinates: leads.filter(l => l.latitude != null && l.longitude != null).length,
    leadsWithWebsite: leads.filter(l => !!l.website).length,
    leadsWithDealValue: leads.filter(l => (l.opportunity?.estimatedDealValue ?? 0) > 0).length,
  };

  // 1. Ranked Leads
  const scoredLeads = leads.map(l => {
    const gapCount = countGaps(l);
    const conversionProb = (l.opportunity?.conversionProbability ?? 0.5) * 100;
    const dealValue = l.opportunity?.estimatedDealValue ?? 0;
    const aiScore = l.aiScore ?? 0;

    let score = aiScore * 0.45;
    score += conversionProb * 0.20;
    score += Math.min(100, (dealValue / 10000) * 100) * 0.15;

    const daysSinceUpdate = Math.max(0, (now - l.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
    const recencyScore = Math.max(0, 100 - daysSinceUpdate * 5);
    score += recencyScore * 0.10;

    score += Math.min(100, gapCount * 15) * 0.10;

    if (!isActive(l.pipelineStage)) score *= 0.3;

    return { lead: l, score: Math.round(score), gapCount, conversionProb, dealValue, aiScore };
  });
  scoredLeads.sort((a, b) => b.score - a.score);

  const rankedLeads = scoredLeads.map((s, i) => {
    const parts: string[] = [];
    parts.push(`AI Score ${s.aiScore ?? 'N/A'}`);
    if (s.lead.opportunity?.conversionProbability != null) parts.push(`conversion ${Math.round(s.conversionProb)}%`);
    if (s.dealValue > 0) parts.push(`$${s.dealValue.toLocaleString()}`);
    if (s.gapCount > 0) parts.push(`${s.gapCount} gap(s)`);
    if (s.lead.pipelineStage === 'won' || s.lead.pipelineStage === 'lost') parts.push('deprioritized — closed');
    return {
      id: s.lead.id,
      businessName: s.lead.businessName,
      category: s.lead.category,
      city: s.lead.city,
      rating: s.lead.rating,
      reviewCount: s.lead.reviewCount,
      website: s.lead.website,
      aiScore: s.lead.aiScore,
      pipelineStage: s.lead.pipelineStage,
      conversionProbability: s.lead.opportunity?.conversionProbability ?? null,
      estimatedDealValue: s.lead.opportunity?.estimatedDealValue ?? null,
      gapCount: s.gapCount,
      score: s.score,
      explanation: `Ranked #${i + 1}: ${parts.join(', ')}`,
    };
  });

  // 2. Similar Companies
  let similarCompanies: any;
  if (referenceLeadId) {
    const sourceLead = leads.find(l => l.id === referenceLeadId);
    if (!sourceLead) {
      similarCompanies = { empty: true, reason: 'Reference lead not found in dataset' };
    } else {
      const refCats = categoryTokenize(sourceLead.category);
      const refCity = sourceLead.city;
      const refLat = sourceLead.latitude;
      const refLon = sourceLead.longitude;
      const refRating = sourceLead.rating ?? 0;

      const scored: any[] = [];
      for (const other of leads) {
        if (other.id === referenceLeadId) continue;
        let simScore = 0;
        const otherCats = categoryTokenize(other.category);
        const sharedCat = refCats.some((t: string) => otherCats.includes(t));
        const sharedCityBool = cityMatch(refCity, other.city);
        const dist = (refLat != null && refLon != null && other.latitude != null && other.longitude != null)
          ? haversineDistance(refLat, refLon, other.latitude, other.longitude) : null;
        const ratingDiff = Math.abs(refRating - (other.rating ?? 0));

        if (sharedCat) simScore += 40;
        if (sharedCityBool) simScore += 30;
        if (dist != null && dist < 10) simScore += 20;
        else if (dist != null && dist < 50) simScore += 10;
        if (refRating > 0 && ratingDiff < 1.0) simScore += 10;

        if (simScore > 0) {
          scored.push({ lead: other, score: simScore, sharedCat, sharedCity: sharedCityBool, dist, ratingDiff });
        }
      }

      scored.sort((a: any, b: any) => b.score - a.score);
      const top = scored.slice(0, 10);

      if (top.length === 0) {
        similarCompanies = { empty: true, reason: `No other imported leads match "${sourceLead.businessName}" — try importing more leads in this category or city.` };
      } else {
        similarCompanies = top.map((s: any) => ({
          id: s.lead.id,
          businessName: s.lead.businessName,
          category: s.lead.category,
          city: s.lead.city,
          rating: s.lead.rating,
          similarityScore: s.score,
          sharedCategory: s.sharedCat,
          sharedCity: s.sharedCity,
          distanceKm: s.dist,
          explanation: `Similarity ${s.score}/100: ${s.sharedCat ? 'same category' : 'different category'}${s.sharedCity ? ', same city' : ''}${s.dist != null ? `, ${s.dist} km` : ''}${s.ratingDiff < 1 ? ', similar rating' : ''}`,
        }));
      }
    }
  } else {
    similarCompanies = { empty: true, reason: 'Select a lead to find similar companies' };
  }

  // 3. Nearby Opportunities
  let nearbyOpportunities: any;
  const leadsWithCoords = leads.filter(l => l.latitude != null && l.longitude != null);
  if (leadsWithCoords.length < 2) {
    nearbyOpportunities = { empty: true, reason: `Only ${leadsWithCoords.length} lead(s) have coordinates. Import leads with coordinate data to enable proximity search.` };
  } else {
    const refLead = referenceLeadId
      ? leads.find(l => l.id === referenceLeadId)
      : leadsWithCoords[0];
    if (!refLead || refLead.latitude == null || refLead.longitude == null) {
      nearbyOpportunities = { empty: true, reason: referenceLeadId ? 'Selected lead has no coordinates.' : 'No lead with coordinates found to use as reference.' };
    } else {
      const distanced = leadsWithCoords
        .filter(l => l.id !== refLead.id)
        .map(l => ({
          lead: l,
          distance: haversineDistance(refLead.latitude!, refLead.longitude!, l.latitude!, l.longitude!),
        }))
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 15);

      if (distanced.length === 0) {
        nearbyOpportunities = { empty: true, reason: 'No other leads with coordinates found near the reference point.' };
      } else {
        nearbyOpportunities = distanced.map(d => ({
          id: d.lead.id,
          businessName: d.lead.businessName,
          category: d.lead.category,
          city: d.lead.city,
          distanceKm: d.distance,
          explanation: `${d.distance} km from ${refLead.businessName} — ${d.lead.city || d.lead.businessName}`,
        }));
      }
    }
  }

  // 4. Market Gaps
  let marketGaps: any;
  const cities = new Set(leads.filter(l => l.city).map(l => l.city!.toLowerCase().trim()));
  const allCategoryCounts = new Map<string, number>();
  for (const l of leads) {
    const tokens = categoryTokenize(l.category);
    for (const t of tokens) allCategoryCounts.set(t, (allCategoryCounts.get(t) || 0) + 1);
  }
  const cityCategoryCounts = new Map<string, Map<string, number>>();
  for (const lead of leads) {
    const city = (lead.city || '').toLowerCase().trim();
    if (!city) continue;
    if (!cityCategoryCounts.has(city)) cityCategoryCounts.set(city, new Map());
    const catMap = cityCategoryCounts.get(city)!;
    const tokens = categoryTokenize(lead.category);
    for (const t of tokens) catMap.set(t, (catMap.get(t) || 0) + 1);
  }

  if (cities.size === 0 || allCategoryCounts.size === 0) {
    marketGaps = { empty: true, reason: 'Not enough category or city data. Import leads with category and city fields.' };
  } else {
    const gapResults: any[] = [];
    for (const city of Array.from(cities)) {
      const leadsInCity = leads.filter(l => l.city && l.city.toLowerCase().trim() === city);
      if (leadsInCity.length < 3) continue;
      const catMap = cityCategoryCounts.get(city);
      if (!catMap) continue;
      for (const [catName, count] of Array.from(catMap.entries())) {
        if (count > 1) continue;
        const leadsInCatGlobally = leads.filter(l => categoryTokenize(l.category).includes(catName));
        if (leadsInCatGlobally.length < 2) continue;
        const avgRating = leadsInCatGlobally.reduce((s, l) => s + (l.rating ?? 0), 0) / leadsInCatGlobally.length;
        const avgReviews = leadsInCatGlobally.reduce((s, l) => s + (l.reviewCount ?? 0), 0) / leadsInCatGlobally.length;
        const avgValue = leadsInCatGlobally.reduce((s, l) => s + (l.opportunity?.estimatedDealValue ?? 0), 0) / leadsInCatGlobally.length;

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

  // 5. High Conversion
  const conversionSorted = leads
    .filter(l => l.opportunity?.conversionProbability != null)
    .sort((a, b) => (b.opportunity?.conversionProbability ?? 0) - (a.opportunity?.conversionProbability ?? 0))
    .slice(0, 10);

  const highConversionLeads = conversionSorted.map((l, i) => {
    const gapCount = countGaps(l);
    const convPct = (l.opportunity?.conversionProbability ?? 0) * 100;
    return {
      id: l.id,
      businessName: l.businessName,
      category: l.category,
      city: l.city,
      conversionProbability: l.opportunity?.conversionProbability ?? null,
      gapCount,
      estimatedDealValue: l.opportunity?.estimatedDealValue ?? null,
      explanation: `Conversion probability ${Math.round(convPct)}% — ${gapCount} gap(s). ${l.opportunity?.estimatedDealValue ? `Est. value $${l.opportunity.estimatedDealValue.toLocaleString()}.` : ''}`,
    };
  });

  // 6. Smart Filters
  const smartFilterDefs = [
    { key: 'highest_revenue', label: 'Highest Revenue Potential' },
    { key: 'weak_online', label: 'Weak Online Presence' },
    { key: 'no_website', label: 'No Website' },
    { key: 'low_reviews', label: 'Low Reviews' },
    { key: 'no_seo', label: 'No SEO Optimization' },
  ];

  const smartFilters = smartFilterDefs.map(def => {
    let filtered: LeadRow[] = [];
    switch (def.key) {
      case 'highest_revenue':
        filtered = [...leads].filter(l => (l.opportunity?.estimatedDealValue ?? 0) > 0);
        filtered.sort((a, b) => (b.opportunity?.estimatedDealValue ?? 0) - (a.opportunity?.estimatedDealValue ?? 0));
        break;
      case 'weak_online':
        filtered = leads.filter(l => {
          const noWeb = !l.website;
          const socCount = countSocialProfiles(l.enrichment || {});
          const hasNoWebGap = hasActiveGap(l, 'no_website');
          const hasPoorWeb = hasActiveGap(l, 'poor_website');
          return (noWeb || hasNoWebGap || hasPoorWeb) && socCount === 0;
        });
        filtered.sort((a, b) => countGaps(b) - countGaps(a));
        break;
      case 'no_website':
        filtered = leads.filter(l => !l.website);
        break;
      case 'low_reviews':
        filtered = leads.filter(l => (l.reviewCount ?? 0) < 10);
        filtered.sort((a, b) => (a.reviewCount ?? 0) - (b.reviewCount ?? 0));
        break;
      case 'no_seo':
        filtered = leads.filter(l => hasActiveGap(l, 'no_seo'));
        filtered.sort((a, b) => countGaps(b) - countGaps(a));
        break;
    }

    const mapped = filtered.slice(0, 25).map((l, i) => {
      let explanation = `#${i + 1}: `;
      switch (def.key) {
        case 'highest_revenue':
          explanation += `Est. deal value $${(l.opportunity?.estimatedDealValue ?? 0).toLocaleString()}`;
          break;
        case 'weak_online':
          explanation += `${countGaps(l)} gap(s), ${countSocialProfiles(l.enrichment || {})} social profile(s)`;
          break;
        case 'no_website':
          explanation += `No website URL detected`;
          break;
        case 'low_reviews':
          explanation += `${l.reviewCount ?? 0} reviews`;
          break;
        case 'no_seo':
          const seoGaps = getDetectedGaps(l).filter((g: any) => g.type === 'no_seo' && g.detected);
          explanation += `SEO: ${seoGaps.map((g: any) => g.detail).join('; ')}`;
          break;
      }
      if (l.aiScore != null) explanation += ` · AI Score ${l.aiScore}`;
      return {
        id: l.id,
        businessName: l.businessName,
        category: l.category,
        city: l.city,
        explanation,
      };
    });

    return { label: def.label, filterKey: def.key, count: filtered.length, leads: mapped };
  });

  return {
    computedAt,
    rankedLeads,
    similarCompanies,
    nearbyOpportunities,
    marketGaps,
    highConversionLeads,
    smartFilters,
    stats,
  };
}
