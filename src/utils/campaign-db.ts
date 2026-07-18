import { Campaign, CampaignLedgerEntry } from '../types';
import { apiRequest } from './api-request';

// ── IndexedDB read-only helpers (for one-time migration) ──────────────────

const DB_NAME = 'CreativeLeadDB';
const DB_VERSION = 4;
const CAMPAIGN_STORE = 'campaigns';
const LEDGER_STORE = 'campaign_ledger';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not available'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {};
  });
}

export async function readAllCampaignsFromIndexedDB(): Promise<Campaign[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(CAMPAIGN_STORE)) { resolve([]); db.close(); return; }
    const req = db.transaction(CAMPAIGN_STORE, 'readonly').objectStore(CAMPAIGN_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => reject(req.error);
  });
}

export async function readAllLedgerFromIndexedDB(): Promise<CampaignLedgerEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(LEDGER_STORE)) { resolve([]); db.close(); return; }
    const req = db.transaction(LEDGER_STORE, 'readonly').objectStore(LEDGER_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => reject(req.error);
  });
}

// ── Campaign CRUD (server-backed) ─────────────────────────────────────────

export async function saveCampaign(campaign: Campaign): Promise<void> {
  try {
    await apiRequest('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
  } catch { /* ignore */ }
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  try {
    const res = await apiRequest(`/api/campaigns/${id}`);
    if (!res.ok) return undefined;
    const data = await res.json();
    return serverCampaignToClient(data);
  } catch {
    return undefined;
  }
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  try {
    const res = await apiRequest('/api/campaigns');
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map(serverCampaignToClient);
  } catch {
    return [];
  }
}

export async function deleteCampaign(id: string): Promise<void> {
  try {
    await apiRequest(`/api/campaigns/${id}`, { method: 'DELETE' });
  } catch { /* ignore */ }
}

// ── Ledger CRUD (server-backed) ───────────────────────────────────────────

export async function saveLedgerEntry(entry: CampaignLedgerEntry): Promise<void> {
  try {
    await apiRequest(`/api/campaigns/${entry.campaignId}/ledger`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch { /* ignore */ }
}

export async function saveLedgerEntries(entries: CampaignLedgerEntry[]): Promise<void> {
  for (const entry of entries) {
    try {
      await saveLedgerEntry(entry);
    } catch { /* skip failed entries */ }
  }
}

export async function getCampaignLedger(campaignId: string): Promise<CampaignLedgerEntry[]> {
  try {
    const res = await apiRequest(`/api/campaigns/${campaignId}/ledger`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((e: Record<string, unknown>): CampaignLedgerEntry => ({
      id: e.id as string,
      campaignId: e.campaignId as string,
      leadUrl: (e.leadUrl as string) || '',
      stepIndex: (e.stepIndex as number) || 0,
      channel: (e.channel as CampaignLedgerEntry['channel']) || 'email',
      status: (e.status as CampaignLedgerEntry['status']) || 'pending',
      sentAt: e.sentAt as string || undefined,
      errorMessage: e.errorMessage as string || undefined,
      nextScheduledAt: e.nextScheduledAt as string || undefined,
      messageBody: e.body as string || undefined,
      createdAt: e.createdAt as string,
    }));
  } catch {
    return [];
  }
}

export async function getPendingSends(): Promise<CampaignLedgerEntry[]> {
  try {
    const all = await getAllCampaigns();
    const pending: CampaignLedgerEntry[] = [];
    for (const c of all) {
      const ledger = await getCampaignLedger(c.id);
      const now = Date.now();
      pending.push(...ledger.filter(e =>
        e.status === 'pending' &&
        (!e.nextScheduledAt || new Date(e.nextScheduledAt).getTime() <= now)
      ));
    }
    return pending;
  } catch {
    return [];
  }
}

export async function updateLedgerStatus(
  entryId: string,
  status: CampaignLedgerEntry['status'],
  extra?: Partial<CampaignLedgerEntry>
): Promise<void> {
  try {
    await apiRequest(`/api/campaigns/ledger/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, sentAt: extra?.sentAt, errorMessage: extra?.errorMessage, nextScheduledAt: extra?.nextScheduledAt }),
    });
  } catch { /* ignore */ }
}

export async function getTodayFollowUps(): Promise<CampaignLedgerEntry[]> {
  const all = await getPendingSends();
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return all.filter(e => {
    if (!e.nextScheduledAt) return false;
    const t = new Date(e.nextScheduledAt).getTime();
    return t >= start.getTime() && t <= today.getTime();
  });
}

export async function getCampaignStats(campaignId: string): Promise<{ sentCount: number; failedCount: number; replyCount: number; pendingCount: number }> {
  const entries = await getCampaignLedger(campaignId);
  return {
    sentCount: entries.filter(e => e.status === 'sent').length,
    failedCount: entries.filter(e => e.status === 'failed').length,
    replyCount: entries.filter(e => e.status === 'replied').length,
    pendingCount: entries.filter(e => e.status === 'pending').length,
  };
}

export function generateId(): string {
  return 'camp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Helpers ───────────────────────────────────────────────────────────────

function serverCampaignToClient(c: Record<string, unknown>): Campaign {
  return {
    id: c.id as string,
    name: c.name as string,
    channel: (c.channel as Campaign['channel']) || 'email',
    messageTemplate: (c.messageTemplate as string) || '',
    subjectTemplate: c.subjectTemplate as string || undefined,
    recipientLeadUrls: (c.recipientLeadUrls as string[]) || [],
    scheduleType: (c.scheduleType as Campaign['scheduleType']) || 'immediate',
    scheduledAt: c.scheduledAt as string || undefined,
    followUpSteps: (c.followUpSteps as Campaign['followUpSteps']) || [],
    status: (c.status as Campaign['status']) || 'draft',
    createdAt: (c.createdAt as string) || new Date().toISOString(),
    updatedAt: (c.updatedAt as string) || new Date().toISOString(),
    stats: (c.stats as Campaign['stats']) || { sentCount: 0, failedCount: 0, replyCount: 0, leadsInCampaign: 0, followUpsCompleted: 0, followUpsTotal: 0 },
  };
}
