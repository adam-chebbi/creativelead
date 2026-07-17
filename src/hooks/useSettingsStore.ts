import { useState, useEffect } from 'react';
import { AiProvider } from '../utils/api-client';

export interface ScoringChip {
  id: string;
  label: string;
  description: string;
  points: number;
  enabled: boolean;
}

export const DEFAULT_CHIPS: ScoringChip[] = [
  { id: 'missing-website', label: 'Missing Website', description: 'Business has no website', points: 10, enabled: true },
  { id: 'outdated-tech', label: 'Outdated Website Technology', description: 'Website uses outdated tech stack', points: 8, enabled: true },
  { id: 'poor-social', label: 'Poor Social Media Presence', description: 'Missing or inactive social profiles', points: 8, enabled: true },
  { id: 'unclaimed-profiles', label: 'Unclaimed Business Profiles', description: 'Not claimed on key directories', points: 6, enabled: true },
  { id: 'mobile-issues', label: 'Mobile Responsiveness Issues', description: 'Website not mobile-friendly', points: 8, enabled: true },
  { id: 'slow-load', label: 'Slow Page Load Speed', description: 'Website loads slowly', points: 7, enabled: true },
  { id: 'accessibility', label: 'Accessibility Issues', description: 'Website has accessibility problems', points: 5, enabled: true },
  { id: 'missing-seo', label: 'Missing SEO Basics', description: 'Missing title/meta/H1 tags', points: 8, enabled: true },
  { id: 'poor-local-seo', label: 'Poor Local Search / Maps Presence', description: 'Weak local search visibility', points: 7, enabled: true },
  { id: 'low-reviews', label: 'Low Review Count', description: 'Business has few reviews', points: 7, enabled: true },
  { id: 'low-rating', label: 'Sub-4.0 Star Rating', description: 'Rating below 4.0 stars', points: 8, enabled: true },
  { id: 'no-analytics', label: 'No Analytics Installed', description: 'Website missing analytics', points: 5, enabled: true },
  { id: 'no-chatbot', label: 'No Live Chat / Chatbot', description: 'No chat or chatbot on website', points: 4, enabled: true },
  { id: 'high-ticket', label: 'High-Ticket Business Category', description: 'High-value service business', points: 9, enabled: true },
];

export interface ScoringWeights {
  opportunity: number;
  competition: number;
  growth: number;
  seo: number;
  website: number;
  reputation: number;
}

export interface ServicePricing {
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

export interface DetectionThresholds {
  lowReviewCount: number;
  lowRatingBar: number;
  minReviewsForRating: number;
}

export interface OpportunityConfig {
  pricing: ServicePricing;
  thresholds: DetectionThresholds;
}

export interface ProviderCredentials {
  emailProvider: 'smtp' | 'sendgrid' | 'gmail' | 'resend';
  emailSmtpHost: string;
  emailSmtpPort: number;
  emailSmtpUser: string;
  emailSmtpPass: string;
  emailFromAddress: string;
  emailFromName: string;
  gmailAddress: string;
  gmailAppPassword: string;
  resendApiKey: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioSmsFromNumber: string;
  twilioWhatsAppFromNumber: string;
}

export interface AppSettings {
  aiProvider: AiProvider;
  aiModel: string;
  geminiApiKey: string;
  openAiKey: string;
  openrouterApiKey: string;
  groqApiKey: string;
  anthropicApiKey: string;
  mistralApiKey: string;
  cohereApiKey: string;
  customApiBase: string;
  customApiKey: string;
  customModel: string;
  enrichmentKey: string;
  enrichmentProvider: 'hunter' | 'clearbit' | 'apollo' | 'none';
  googleSheetsUrl: string;
  weights: ScoringWeights;
  scoringChips: ScoringChip[];
  opportunityConfig: OpportunityConfig;
  providers: ProviderCredentials;
}

const PRICING_DEFAULTS: ServicePricing = {
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

const THRESHOLD_DEFAULTS: DetectionThresholds = {
  lowReviewCount: 10,
  lowRatingBar: 4.0,
  minReviewsForRating: 3,
};

const DEFAULT_SETTINGS: AppSettings = {
  aiProvider: 'gemini',
  aiModel: 'gemini-2.0-flash',
  geminiApiKey: '',
  openAiKey: '',
  openrouterApiKey: '',
  groqApiKey: '',
  anthropicApiKey: '',
  mistralApiKey: '',
  cohereApiKey: '',
  customApiBase: '',
  customApiKey: '',
  customModel: '',
  enrichmentKey: '',
  enrichmentProvider: 'none',
  googleSheetsUrl: '',
  weights: {
    opportunity: 20,
    competition: 20,
    growth: 15,
    seo: 15,
    website: 15,
    reputation: 15,
  },
  scoringChips: [...DEFAULT_CHIPS.map(c => ({ ...c }))],
  opportunityConfig: {
    pricing: PRICING_DEFAULTS,
    thresholds: THRESHOLD_DEFAULTS,
  },
  providers: {
    emailProvider: 'sendgrid',
    emailSmtpHost: '',
    emailSmtpPort: 587,
    emailSmtpUser: '',
    emailSmtpPass: '',
    emailFromAddress: '',
    emailFromName: '',
    gmailAddress: '',
    gmailAppPassword: '',
    resendApiKey: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioSmsFromNumber: '',
    twilioWhatsAppFromNumber: '',
  },
};

const STORAGE_KEY = 'creativelead_settings';

const SECRET_KEYS = new Set([
  'geminiApiKey', 'openAiKey', 'openrouterApiKey', 'groqApiKey',
  'anthropicApiKey', 'mistralApiKey', 'cohereApiKey', 'customApiKey',
  'enrichmentKey', 'emailSmtpPass', 'gmailAppPassword', 'resendApiKey',
  'emailSmtpUser', 'twilioAccountSid', 'twilioAuthToken',
  'twilioSmsFromNumber', 'twilioWhatsAppFromNumber',
]);

function mergeSettings(base: AppSettings, overrides: Partial<AppSettings>): AppSettings {
  return {
    ...base,
    ...overrides,
    weights: { ...base.weights, ...(overrides.weights || {}) },
    scoringChips: Array.isArray(overrides.scoringChips) ? overrides.scoringChips : base.scoringChips,
    opportunityConfig: {
      pricing: { ...base.opportunityConfig.pricing, ...(overrides.opportunityConfig?.pricing || {}) },
      thresholds: { ...base.opportunityConfig.thresholds, ...(overrides.opportunityConfig?.thresholds || {}) },
    },
    providers: { ...base.providers, ...(overrides.providers || {}) },
  };
}

function mergeApiIntoLocal(local: AppSettings, fromApi: Record<string, unknown>): AppSettings {
  const nonSecretOverrides: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fromApi)) {
    if (!SECRET_KEYS.has(key) || !local[key as keyof AppSettings]) {
      nonSecretOverrides[key] = value;
    }
  }
  return mergeSettings(local, nonSecretOverrides as unknown as Partial<AppSettings>);
}

export function getSettings(): AppSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (!parsed.geminiApiKey && parsed.enrichmentKey && !parsed.aiProvider) {
        parsed.geminiApiKey = parsed.enrichmentKey;
      }
      if (!parsed.aiProvider) {
        parsed.aiProvider = parsed.openAiKey ? 'openai' : 'gemini';
      }
      return mergeSettings(DEFAULT_SETTINGS, parsed);
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings, organizationId?: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event('settingsUpdated'));

  if (organizationId) {
    const clerk = (window as any).Clerk;
    const userId = clerk?.session?.user?.id;
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, settings, updatedById: userId }),
    }).catch(() => {});
  }
}

export function useSettingsStore() {
  const [settings, setSettings] = useState<AppSettings>(
    typeof window !== 'undefined' ? getSettings() : DEFAULT_SETTINGS
  );
  const [loadedFromDb, setLoadedFromDb] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const clerk = (window as any).Clerk;
    const orgId = clerk?.session?.lastActiveOrganizationId || clerk?.organization?.id;

    if (orgId) {
      fetch(`/api/settings?organizationId=${encodeURIComponent(orgId)}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          if (data.settings && typeof data.settings === 'object') {
            const local = getSettings();
            const fromApi = data.settings as Record<string, unknown>;
            const merged = mergeApiIntoLocal(local, fromApi);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            setSettings(merged);
          }
          setLoadedFromDb(true);
        })
        .catch(() => setLoadedFromDb(true));
    } else {
      setLoadedFromDb(true);
    }

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleUpdate = () => setSettings(getSettings());
    window.addEventListener('settingsUpdated', handleUpdate);
    return () => window.removeEventListener('settingsUpdated', handleUpdate);
  }, []);

  return {
    settings,
    loadedFromDb,
    updateSettings: (updates: Partial<AppSettings>) => {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      const clerk = (window as any).Clerk;
      const orgId = clerk?.session?.lastActiveOrganizationId || clerk?.organization?.id;
      saveSettings(newSettings, orgId);
    },
  };
}
