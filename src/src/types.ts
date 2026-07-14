// Canonical field list matching schema.json — single source of truth for JS/TS
export const SCHEMA_FIELDS = [
  'business_name', 'category', 'subcategory', 'address', 'city', 'state',
  'country', 'postal_code', 'latitude', 'longitude', 'phone_number', 'website',
  'google_maps_url', 'description', 'rating', 'review_count', 'business_status',
  'business_hours', 'email', 'social_profiles', 'services', 'products',
  'accessibility', 'amenities', 'payments', 'other_about', 'reviews',
] as const;

export type SchemaField = (typeof SCHEMA_FIELDS)[number];

export const REQUIRED_FIELDS: SchemaField[] = ['business_name'];

export interface ReviewRecord {
  reviewer_name: string | null;
  review_rating: number | null;
  review_date: string | null;
  review_relative_time: string | null;
  review_text: string | null;
  review_url: string | null;
}

export interface Lead {
  business_name: string;
  category: string;
  subcategory?: string | null;
  address: string;
  city: string;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  phone_number?: string | null;
  website?: string | null;
  phone?: string | null;
  location?: string | null;
  maps_url?: string | null;
  google_maps_url?: string;
  description?: string | null;
  rating?: number | null;
  review_count?: number | null;
  business_status?: string | null;
  business_hours?: Record<string, string> | null;
  email?: string | null;
  social_profiles?: string[] | null;
  services?: string[] | null;
  products?: string[] | null;
  accessibility?: string[] | null;
  amenities?: string[] | null;
  payments?: string[] | null;
  other_about?: Record<string, unknown> | null;
  reviews?: ReviewRecord[];
  
  // AI & Enrichment Fields
  ai_score?: number;
  classification?: 'Hot' | 'Warm' | 'Cold';
  opportunity_score?: number;
  competition_score?: number;
  growth_score?: number;
  seo_weakness?: number;
  website_quality?: number;
  review_reputation?: number;
  
  business_size?: string;
  employee_estimation?: string;
  revenue_estimation?: string;
  industry_classification?: string;
  generated_description?: string;
  
  emails?: string[];
  additional_phones?: string[];
  linkedin?: string;
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;

  enrichment_status?: 'not_enriched' | 'enriching' | 'enriched' | 'failed';
  enrichment_error?: string;
  enrichment_confidence?: 'high' | 'medium' | 'low';
  enrichment_evidence?: EnrichmentEvidence;
  enrichment_last_run?: string;

  website_intelligence?: WebsiteIntelligence;

  // Opportunity Detector Fields
  opportunity_gaps?: OpportunityGap[];
  recommended_service?: string;
  recommended_service_details?: string;
  estimated_deal_value?: number;
  deal_value_breakdown?: DealValueBreakdown;
  conversion_probability?: number;
  conversion_factors?: ConversionFactor[];
  opportunity_confidence?: 'high' | 'medium' | 'low';

  // Outreach Fields
  outreach_messages?: OutreachMessages;

  // Pipeline Fields
  _stage?: PipelineStage;
  _stageHistory?: PipelineStageEntry[];
  _stageEnteredAt?: string;
  _wonLostReason?: string;

  [key: string]: unknown;
}

export interface OutreachMessages {
  email: OutreachMessage;
  linkedin: OutreachMessage;
  whatsapp: OutreachMessage;
  proposalIntro: OutreachMessage;
  generatedAt: string;
}

export interface OutreachMessage {
  subject?: string;
  body: string;
  edited: boolean;
}

export interface OpportunityGap {
  type: 'no_website' | 'poor_website' | 'low_reviews' | 'no_social' | 'no_seo' | 'no_phone' | 'no_email' | 'no_ssl' | 'slow_site' | 'missing_analytics' | 'missing_chatbot';
  label: string;
  severity: 'critical' | 'moderate' | 'minor';
  detail: string;
  detected: boolean;
}

// Website Intelligence
export interface DetectedTechnology {
  name: string;
  category: 'cms' | 'framework' | 'analytics' | 'chatbot' | 'hosting' | 'other';
  confidence: 'high' | 'medium' | 'low';
  signal: string;
}

export interface SeoAuditResult {
  hasTitle: boolean;
  titleContent: string | null;
  hasMetaDescription: boolean;
  metaDescriptionContent: string | null;
  hasH1: boolean;
  hasMultipleH1: boolean;
  headingStructure: { h1: number; h2: number; h3: number };
  hasImageAlt: boolean;
  missingAltCount: number;
  hasCanonical: boolean;
  canonicalUrl: string | null;
  robotsTxtAccessible: boolean;
  sitemapXmlAccessible: boolean;
  hasStructuredData: boolean;
  structuredDataTypes: string[];
  score: number;
}

export interface PerformanceAudit {
  loadTimeMs: number;
  pageSizeBytes: number;
  pageSizeFormatted: string;
  coreWebVitals: {
    lcp?: number;
    fcp?: number;
    tti?: number;
    source: 'measured' | 'estimated' | 'unavailable';
  };
  score: number;
}

export interface WebsiteIntelligence {
  url: string;
  reachable: boolean;
  error: string | null;
  statusCode: number | null;
  isHttps: boolean;
  hasValidSsl: boolean;
  sslDetails: string | null;
  hasViewportMeta: boolean;
  technologies: DetectedTechnology[];
  seo: SeoAuditResult;
  performance: PerformanceAudit;
  hasAnalytics: boolean;
  analyticsFound: string[];
  hasChatbot: boolean;
  chatbotFound: string[];
  improvementOpportunities: string[];
  analyzedAt: string;
}

export interface DealValueBreakdown {
  baseServicePrice: number;
  gapMultiplier: number;
  categoryAdjustment: number;
  finalValue: number;
  gapsFound: number;
  industry: string;
}

export interface ConversionFactor {
  factor: string;
  impact: 'positive' | 'negative' | 'neutral';
  reason: string;
  weight: number;
}

export interface EnrichmentSource {
  type: 'website_scrape' | 'enrichment_api' | 'ai_estimate';
  label: string;
  url?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface EnrichmentEvidence {
  emails: EnrichmentSource[];
  additional_phones: EnrichmentSource[];
  linkedin: EnrichmentSource[];
  facebook: EnrichmentSource[];
  instagram: EnrichmentSource[];
  tiktok: EnrichmentSource[];
  youtube: EnrichmentSource[];
  business_size: EnrichmentSource[];
  revenue_estimation: EnrichmentSource[];
  industry_classification: EnrichmentSource[];
  generated_description: EnrichmentSource[];
}

// Campaign Fields
export interface Campaign {
  id: string;
  name: string;
  channel: 'email' | 'whatsapp' | 'sms';
  messageTemplate: string;
  subjectTemplate?: string;
  recipientLeadUrls: string[];
  scheduleType: 'immediate' | 'scheduled';
  scheduledAt?: string;
  followUpSteps: CampaignFollowUpStep[];
  status: 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  stats: CampaignStats;
}

export interface CampaignFollowUpStep {
  dayOffset: number;
  subjectTemplate?: string;
  messageTemplate: string;
  stepIndex: number;
}

export interface CampaignStats {
  sentCount: number;
  failedCount: number;
  replyCount: number;
  leadsInCampaign: number;
  followUpsCompleted: number;
  followUpsTotal: number;
}

export interface CampaignLedgerEntry {
  id: string;
  campaignId: string;
  leadUrl: string;
  stepIndex: number;
  channel: 'email' | 'whatsapp' | 'sms';
  status: 'pending' | 'sent' | 'failed' | 'replied' | 'bounced';
  sentAt?: string;
  errorMessage?: string;
  nextScheduledAt?: string;
  messageBody?: string;
  createdAt: string;
}

export interface ImportResult {
  leads: Lead[];
  errors: string[];
  source: 'json';
  fileName: string;
}

// Pipeline Types
export type PipelineStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface PipelineStageEntry {
  stage: PipelineStage;
  enteredAt: string;
}

export interface FollowUp {
  id: string;
  leadUrl: string;
  dueAt: string;
  note: string;
  completed: boolean;
  createdAt: string;
}

export interface LeadNote {
  id: string;
  leadUrl: string;
  text: string;
  createdAt: string;
}

export interface LeadAttachment {
  id: string;
  leadUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  data: string; // base64 encoded
  uploadedAt: string;
}
