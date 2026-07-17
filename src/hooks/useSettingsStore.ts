import { useState, useEffect } from 'react';
import { AiProvider } from '../utils/api-client';

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
  emailSmtpHost: string;
  emailSmtpPort: number;
  emailSmtpUser: string;
  emailSmtpPass: string;
  emailFromAddress: string;
  emailFromName: string;
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
  opportunityConfig: {
    pricing: PRICING_DEFAULTS,
    thresholds: THRESHOLD_DEFAULTS,
  },
  providers: {
    emailSmtpHost: '',
    emailSmtpPort: 587,
    emailSmtpUser: '',
    emailSmtpPass: '',
    emailFromAddress: '',
    emailFromName: '',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioSmsFromNumber: '',
    twilioWhatsAppFromNumber: '',
  },
};

const STORAGE_KEY = 'creativelead_settings';

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
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        weights: { ...DEFAULT_SETTINGS.weights, ...(parsed.weights || {}) },
        opportunityConfig: {
          pricing: { ...DEFAULT_SETTINGS.opportunityConfig.pricing, ...(parsed.opportunityConfig?.pricing || {}) },
          thresholds: { ...DEFAULT_SETTINGS.opportunityConfig.thresholds, ...(parsed.opportunityConfig?.thresholds || {}) },
        },
        providers: { ...DEFAULT_SETTINGS.providers, ...(parsed.providers || {}) },
      };
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event('settingsUpdated'));
}

export function useSettingsStore() {
  const [settings, setSettings] = useState<AppSettings>(
    typeof window !== 'undefined' ? getSettings() : DEFAULT_SETTINGS
  );

  useEffect(() => {
    const handleUpdate = () => setSettings(getSettings());
    window.addEventListener('settingsUpdated', handleUpdate);
    return () => window.removeEventListener('settingsUpdated', handleUpdate);
  }, []);

  return {
    settings,
    updateSettings: (updates: Partial<AppSettings>) => {
      const newSettings = { ...settings, ...updates };
      setSettings(newSettings);
      saveSettings(newSettings);
    },
  };
}
