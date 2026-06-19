export interface Lead {
  id: string;
  userId: string;
  name: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  googleMapsUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  category: string;
  city: string;
  businessType: string;
  stage: string;
  notes?: string | null;
  unsubscribed: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { reviews: number };
}

export interface Review {
  id: string;
  businessId: string;
  authorName: string;
  authorImageUrl?: string | null;
  rating?: number | null;
  text?: string | null;
  publishedAt?: string | null;
  createdAt: string;
}

export interface ScrapingSession {
  id: string;
  userId: string;
  city: string;
  businessType: string;
  maxResults: number;
  scrapeReviews: boolean;
  leadsCollected: number;
  reviewsCollected: number;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  endReason?: string | null;
  workerVersion?: string | null;
}

export interface WorkerSession {
  id: string;
  userId: string;
  machineName: string;
  platform: string;
  workerVersion: string;
  connectedAt: string;
  lastPing: string;
  status: string;
}

export interface DashboardStats {
  totalLeads: number;
  leadsWithEmail: number;
  emailsSentThisMonth: number;
  emailsSentToday: number;
  stageBreakdown: Record<string, number>;
  activeSession?: ScrapingSession | null;
  workerOnline: boolean;
  workerInfo?: WorkerSession | null;
  recentLeads: Lead[];
}

export interface PipelineData {
  stages: Record<string, Lead[]>;
  counts: { new: number; contacted: number; replied: number; closed: number; total: number };
  conversionRates: { newToContacted: number; contactedToReplied: number; repliedToClosed: number };
}

export interface UserSettings {
  emailTemplate?: string | null;
  followupStep3Enabled: boolean;
  followupStep7Enabled: boolean;
  followupStep14Enabled: boolean;
  followupStep3Days: number;
  followupStep7Days: number;
  followupStep14Days: number;
  scrollDelayMin: number;
  scrollDelayMax: number;
  defaultLanguage: string;
  hasResendKey: boolean;
  hasGroqKey: boolean;
  resendFromEmail?: string | null;
}

export interface SentEmail {
  id: string;
  businessName: string;
  email: string;
  subject: string;
  dateSent: string;
  language: string;
  status: string;
  fromEmail: string;
}

export type Stage = 'New' | 'Contacted' | 'Replied' | 'Closed' | 'Unsubscribed';
export type Language = 'english' | 'greek' | 'arabic';
