import { Lead, LeadNote, LeadAttachment, FollowUp, PipelineStageEntry } from './types';

const DB_NAME = 'CreativeLeadDB';
const DB_VERSION = 4; // Keep in sync with campaign-db.ts
const STORE_NAME = 'leads';
const NOTES_STORE = 'lead_notes';
const ATTACHMENTS_STORE = 'lead_attachments';
const FOLLOWUPS_STORE = 'lead_followups';

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'google_maps_url' });
      }
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const store = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        store.createIndex('leadUrl', 'leadUrl', { unique: false });
      }
      if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) {
        const store = db.createObjectStore(ATTACHMENTS_STORE, { keyPath: 'id' });
        store.createIndex('leadUrl', 'leadUrl', { unique: false });
      }
      if (!db.objectStoreNames.contains(FOLLOWUPS_STORE)) {
        const store = db.createObjectStore(FOLLOWUPS_STORE, { keyPath: 'id' });
        store.createIndex('leadUrl', 'leadUrl', { unique: false });
        store.createIndex('dueAt', 'dueAt', { unique: false });
      }
    };
  });
}

// ---- Lead CRUD ----

export async function saveLeads(leads: Lead[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    for (const lead of leads) {
      const key = lead.google_maps_url || (lead as Record<string, unknown>)['maps_url'] as string;
      if (key) {
        store.put({ ...lead, google_maps_url: key });
      }
    }
  });
}

export async function getAllLeads(): Promise<Lead[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Lead[]);
    request.onerror = () => reject(request.error);
  });
}

export async function updateLead(google_maps_url: string, updates: Partial<Lead>): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getReq = store.get(google_maps_url);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) { resolve(); return; }
      store.put({ ...existing, ...updates, google_maps_url });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteLeads(urls: string[]): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, NOTES_STORE, ATTACHMENTS_STORE, FOLLOWUPS_STORE], 'readwrite');
    const leadStore = transaction.objectStore(STORE_NAME);
    for (const url of urls) leadStore.delete(url);
    const noteIndex = transaction.objectStore(NOTES_STORE).index('leadUrl');
    const attIndex = transaction.objectStore(ATTACHMENTS_STORE).index('leadUrl');
    const fuIndex = transaction.objectStore(FOLLOWUPS_STORE).index('leadUrl');
    for (const url of urls) {
      noteIndex.openCursor(url).onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      attIndex.openCursor(url).onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      fuIndex.openCursor(url).onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---- Notes CRUD ----

export async function getLeadNotes(leadUrl: string): Promise<LeadNote[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(NOTES_STORE, 'readonly')
      .objectStore(NOTES_STORE)
      .index('leadUrl')
      .getAll(leadUrl);
    req.onsuccess = () => {
      const notes = (req.result || []).sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      resolve(notes);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveLeadNote(note: LeadNote): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readwrite');
    tx.objectStore(NOTES_STORE).put(note);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLeadNote(noteId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(NOTES_STORE, 'readwrite');
    tx.objectStore(NOTES_STORE).delete(noteId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Attachments CRUD ----

export async function getLeadAttachments(leadUrl: string): Promise<LeadAttachment[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(ATTACHMENTS_STORE, 'readonly')
      .objectStore(ATTACHMENTS_STORE)
      .index('leadUrl')
      .getAll(leadUrl);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLeadAttachment(attachment: LeadAttachment): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENTS_STORE, 'readwrite');
    tx.objectStore(ATTACHMENTS_STORE).put(attachment);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLeadAttachment(attachmentId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ATTACHMENTS_STORE, 'readwrite');
    tx.objectStore(ATTACHMENTS_STORE).delete(attachmentId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---- Follow-Ups CRUD ----

export async function getLeadFollowUps(leadUrl: string): Promise<FollowUp[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(FOLLOWUPS_STORE, 'readonly')
      .objectStore(FOLLOWUPS_STORE)
      .index('leadUrl')
      .getAll(leadUrl);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllFollowUps(): Promise<FollowUp[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(FOLLOWUPS_STORE, 'readonly')
      .objectStore(FOLLOWUPS_STORE)
      .getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLeadFollowUp(followUp: FollowUp): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOLLOWUPS_STORE, 'readwrite');
    tx.objectStore(FOLLOWUPS_STORE).put(followUp);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLeadFollowUp(followUpId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOLLOWUPS_STORE, 'readwrite');
    tx.objectStore(FOLLOWUPS_STORE).delete(followUpId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getUpcomingFollowUps(limitDays: number = 7): Promise<FollowUp[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(FOLLOWUPS_STORE, 'readonly')
      .objectStore(FOLLOWUPS_STORE)
      .getAll();
    req.onsuccess = () => {
      const now = new Date().getTime();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + limitDays);
      const cutoffTime = cutoff.getTime();
      const upcoming = (req.result || [])
        .filter(f => !f.completed && new Date(f.dueAt).getTime() >= now && new Date(f.dueAt).getTime() <= cutoffTime)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
      resolve(upcoming);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getOverdueFollowUps(): Promise<FollowUp[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(FOLLOWUPS_STORE, 'readonly')
      .objectStore(FOLLOWUPS_STORE)
      .getAll();
    req.onsuccess = () => {
      const now = new Date().getTime();
      const overdue = (req.result || [])
        .filter(f => !f.completed && new Date(f.dueAt).getTime() < now)
        .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
      resolve(overdue);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markFollowUpCompleted(followUpId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOLLOWUPS_STORE, 'readwrite');
    const store = tx.objectStore(FOLLOWUPS_STORE);
    const getReq = store.get(followUpId);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (!existing) { resolve(); return; }
      store.put({ ...existing, completed: true });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function generateId(): string {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function getStageHistory(lead: Lead): PipelineStageEntry[] {
  const raw = lead._stageHistory;
  if (Array.isArray(raw)) return raw as PipelineStageEntry[];
  return [];
}