import { Campaign, CampaignLedgerEntry } from '../types';

const DB_NAME = 'CreativeLeadDB';
// Must be >= the version in db.ts (currently 3). Bump here whenever stores are added.
const DB_VERSION = 4;
const CAMPAIGN_STORE = 'campaigns';
const LEDGER_STORE = 'campaign_ledger';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // ── Core stores (owned by db.ts — create if missing) ──────────────
      if (!db.objectStoreNames.contains('leads')) {
        db.createObjectStore('leads', { keyPath: 'google_maps_url' });
      }
      if (!db.objectStoreNames.contains('lead_notes')) {
        const s = db.createObjectStore('lead_notes', { keyPath: 'id' });
        s.createIndex('leadUrl', 'leadUrl', { unique: false });
      }
      if (!db.objectStoreNames.contains('lead_attachments')) {
        const s = db.createObjectStore('lead_attachments', { keyPath: 'id' });
        s.createIndex('leadUrl', 'leadUrl', { unique: false });
      }
      if (!db.objectStoreNames.contains('lead_followups')) {
        const s = db.createObjectStore('lead_followups', { keyPath: 'id' });
        s.createIndex('leadUrl', 'leadUrl', { unique: false });
        s.createIndex('dueAt', 'dueAt', { unique: false });
      }

      // ── Campaign stores ────────────────────────────────────────────────
      if (!db.objectStoreNames.contains(CAMPAIGN_STORE)) {
        db.createObjectStore(CAMPAIGN_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LEDGER_STORE)) {
        const store = db.createObjectStore(LEDGER_STORE, { keyPath: 'id' });
        store.createIndex('campaignId', 'campaignId', { unique: false });
        store.createIndex('leadUrl', 'leadUrl', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Campaign CRUD
export async function saveCampaign(campaign: Campaign): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CAMPAIGN_STORE], 'readwrite');
    tx.objectStore(CAMPAIGN_STORE).put(campaign);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(CAMPAIGN_STORE, 'readonly').objectStore(CAMPAIGN_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(CAMPAIGN_STORE, 'readonly').objectStore(CAMPAIGN_STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCampaign(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CAMPAIGN_STORE], 'readwrite');
    tx.objectStore(CAMPAIGN_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Ledger CRUD
export async function saveLedgerEntry(entry: CampaignLedgerEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([LEDGER_STORE], 'readwrite');
    tx.objectStore(LEDGER_STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveLedgerEntries(entries: CampaignLedgerEntry[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([LEDGER_STORE], 'readwrite');
    const store = tx.objectStore(LEDGER_STORE);
    for (const entry of entries) store.put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCampaignLedger(campaignId: string): Promise<CampaignLedgerEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(LEDGER_STORE, 'readonly')
      .objectStore(LEDGER_STORE)
      .index('campaignId')
      .getAll(campaignId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getPendingSends(): Promise<CampaignLedgerEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(LEDGER_STORE, 'readonly')
      .objectStore(LEDGER_STORE)
      .index('status')
      .getAll('pending');
    req.onsuccess = () => {
      const now = Date.now();
      const due = req.result.filter(e => !e.nextScheduledAt || new Date(e.nextScheduledAt).getTime() <= now);
      resolve(due);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function updateLedgerStatus(
  entryId: string,
  status: CampaignLedgerEntry['status'],
  extra?: Partial<CampaignLedgerEntry>
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([LEDGER_STORE], 'readwrite');
    const store = tx.objectStore(LEDGER_STORE);
    const getReq = store.get(entryId);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) { resolve(); return; }
      store.put({ ...existing, ...extra, status });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
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