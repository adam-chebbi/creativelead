import { Lead, LeadNote, LeadAttachment, FollowUp, PipelineStageEntry } from './types';
import { apiRequest } from '@/utils/api-request';

// ── IndexedDB helpers (read-only, for one-time migration only) ──────────────

const DB_NAME = 'CreativeLeadDB';
const DB_VERSION = 4;
const STORE_NAME = 'leads';
const NOTES_STORE = 'lead_notes';
const ATTACHMENTS_STORE = 'lead_attachments';
const FOLLOWUPS_STORE = 'lead_followups';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB not available'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {};
  });
}

export async function readAllLeadsFromIndexedDB(): Promise<Lead[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) { resolve([]); db.close(); return; }
    const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => reject(req.error);
  });
}

export async function readAllNotesFromIndexedDB(): Promise<LeadNote[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(NOTES_STORE)) { resolve([]); db.close(); return; }
    const req = db.transaction(NOTES_STORE, 'readonly').objectStore(NOTES_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => reject(req.error);
  });
}

export async function readAllAttachmentsFromIndexedDB(): Promise<LeadAttachment[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(ATTACHMENTS_STORE)) { resolve([]); db.close(); return; }
    const req = db.transaction(ATTACHMENTS_STORE, 'readonly').objectStore(ATTACHMENTS_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => reject(req.error);
  });
}

export async function readAllFollowUpsFromIndexedDB(): Promise<FollowUp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(FOLLOWUPS_STORE)) { resolve([]); db.close(); return; }
    const req = db.transaction(FOLLOWUPS_STORE, 'readonly').objectStore(FOLLOWUPS_STORE).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result || []); };
    req.onerror = () => reject(req.error);
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveLeadId(leadUrl: string): string | null {
  if (leadUrl.startsWith('server:')) return leadUrl.slice(7);
  return null;
}

// ── Notes CRUD (server-backed) ─────────────────────────────────────────────

export async function getLeadNotes(leadUrl: string): Promise<LeadNote[]> {
  const leadId = resolveLeadId(leadUrl);
  if (!leadId) return [];

  try {
    const res = await apiRequest(`/api/leads/${leadId}/notes`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((n: Record<string, unknown>) => ({
      id: n.id as string,
      leadUrl: leadUrl,
      text: (n.body as string) || '',
      createdAt: n.createdAt as string,
    } as LeadNote));
  } catch {
    return [];
  }
}

export async function saveLeadNote(note: LeadNote): Promise<void> {
  const leadId = resolveLeadId(note.leadUrl);
  if (!leadId) return;
  try {
    await apiRequest(`/api/leads/${leadId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: note.text, createdAt: note.createdAt }),
    });
  } catch { /* ignore */ }
}

export async function deleteLeadNote(noteId: string): Promise<void> {
  try {
    await apiRequest(`/api/notes/${noteId}`, { method: 'DELETE' });
  } catch { /* ignore */ }
}

// ── Attachments CRUD (server-backed) ───────────────────────────────────────

export async function getLeadAttachments(leadUrl: string): Promise<LeadAttachment[]> {
  const leadId = resolveLeadId(leadUrl);
  if (!leadId) return [];

  try {
    const res = await apiRequest(`/api/leads/${leadId}/attachments`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((a: Record<string, unknown>) => ({
      id: a.id as string,
      leadUrl,
      fileName: (a.fileName as string) || 'file',
      fileType: (a.fileType as string) || '',
      fileSize: (a.fileSize as number) || 0,
      data: (a.fileUrl as string) || '',
      uploadedAt: a.uploadedAt as string || a.createdAt as string || new Date().toISOString(),
    } as LeadAttachment));
  } catch {
    return [];
  }
}

export async function saveLeadAttachment(attachment: LeadAttachment): Promise<void> {
  const leadId = resolveLeadId(attachment.leadUrl);
  if (!leadId) return;
  try {
    await apiRequest(`/api/leads/${leadId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: attachment.data, fileName: attachment.fileName }),
    });
  } catch { /* ignore */ }
}

export async function deleteLeadAttachment(attachmentId: string): Promise<void> {
  try {
    await apiRequest(`/api/attachments/${attachmentId}`, { method: 'DELETE' });
  } catch { /* ignore */ }
}

// ── Follow-Ups CRUD (server-backed) ───────────────────────────────────────

export async function getLeadFollowUps(leadUrl: string): Promise<FollowUp[]> {
  const leadId = resolveLeadId(leadUrl);
  if (!leadId) return [];

  try {
    const res = await apiRequest(`/api/leads/${leadId}/followups`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      leadUrl,
      dueAt: f.dueAt as string,
      note: '',
      completed: (f.status as string) === 'completed',
      createdAt: f.createdAt as string,
    } as FollowUp));
  } catch {
    return [];
  }
}

export async function getAllFollowUps(): Promise<FollowUp[]> {
  try {
    const res = await apiRequest('/api/followups');
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      leadUrl: `server:${f.leadId as string}`,
      dueAt: f.dueAt as string,
      note: '',
      completed: (f.status as string) === 'completed',
      createdAt: f.createdAt as string,
    } as FollowUp));
  } catch {
    return [];
  }
}

export async function saveLeadFollowUp(followUp: FollowUp): Promise<void> {
  const leadId = resolveLeadId(followUp.leadUrl);
  if (!leadId) return;
  try {
    await apiRequest(`/api/leads/${leadId}/followups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dueAt: followUp.dueAt, completed: followUp.completed }),
    });
  } catch { /* ignore */ }
}

export async function deleteLeadFollowUp(followUpId: string): Promise<void> {
  try {
    await apiRequest(`/api/followups/${followUpId}`, { method: 'DELETE' });
  } catch { /* ignore */ }
}

export async function getUpcomingFollowUps(limitDays: number = 7): Promise<FollowUp[]> {
  try {
    const res = await apiRequest(`/api/followups?type=upcoming&days=${limitDays}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      leadUrl: `server:${f.leadId as string}`,
      dueAt: f.dueAt as string,
      note: '',
      completed: (f.status as string) === 'completed',
      createdAt: f.createdAt as string,
    } as FollowUp));
  } catch {
    return [];
  }
}

export async function getOverdueFollowUps(): Promise<FollowUp[]> {
  try {
    const res = await apiRequest('/api/followups?type=overdue');
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      leadUrl: `server:${f.leadId as string}`,
      dueAt: f.dueAt as string,
      note: '',
      completed: false,
      createdAt: f.createdAt as string,
    } as FollowUp));
  } catch {
    return [];
  }
}

export async function markFollowUpCompleted(followUpId: string): Promise<void> {
  try {
    await apiRequest(`/api/followups/${followUpId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ completed: true }) });
  } catch { /* ignore */ }
}

// ── Local helpers ──────────────────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

export function getStageHistory(lead: Lead): PipelineStageEntry[] {
  const raw = lead._stageHistory;
  if (Array.isArray(raw)) return raw as PipelineStageEntry[];
  return [];
}
