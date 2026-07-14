import { Lead, OpportunityGap } from '../types';

export interface RankedLead {
  lead: Lead;
  rank: number;
  score: number;
  explanation: string;
}

export interface SimilarCompany {
  lead: Lead;
  similarityScore: number;
  sharedCategory: boolean;
  sharedCity: boolean;
  distanceKm: number | null;
  ratingDiff: number;
  explanation: string;
}

export interface NearbyOpportunity {
  lead: Lead;
  distanceKm: number;
  explanation: string;
}

export interface MarketGap {
  category: string;
  city: string;
  leadCount: number;
  avgRating: number;
  avgReviewCount: number;
  avgDealValue: number;
  explanation: string;
}

export interface SmartFilterResult {
  label: string;
  filterKey: string;
  leads: RankedLead[];
  active: boolean;
  count: number;
}

export type SmartFilterKey = 'highest_revenue' | 'weak_online' | 'no_website' | 'low_reviews' | 'no_seo';

export const SMART_FILTER_DEFS: { key: SmartFilterKey; label: string; description: string }[] = [
  { key: 'highest_revenue', label: 'Highest Revenue Potential', description: 'Sorted by estimated deal value (highest first)' },
  { key: 'weak_online', label: 'Weak Online Presence', description: 'Leads with poor or missing website + no social profiles' },
  { key: 'no_website', label: 'No Website', description: 'Leads with no website URL at all' },
  { key: 'low_reviews', label: 'Low Reviews', description: 'Leads with fewer than 10 total reviews' },
  { key: 'no_seo', label: 'No SEO Optimization', description: 'Leads with detected SEO gaps' },
];

export interface RecommendationEngineResult {
  rankedLeads: RankedLead[];
  similarCompanies: SimilarCompany[] | { empty: true; reason: string };
  nearbyOpportunities: NearbyOpportunity[] | { empty: true; reason: string };
  marketGaps: MarketGap[] | { empty: true; reason: string };
  highConversionLeads: RankedLead[];
  smartFilters: SmartFilterResult[];
  stats: {
    totalLeads: number;
    leadsWithScore: number;
    leadsWithCoordinates: number;
    leadsWithWebsite: number;
    leadsWithDealValue: number;
  };
}

export function hasActiveGap(lead: Lead, gapType: OpportunityGap['type']): boolean {
  if (!lead.opportunity_gaps) return false;
  return lead.opportunity_gaps.some(g => g.type === gapType && g.detected);
}