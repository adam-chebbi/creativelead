import axios from 'axios';
import { getSession } from 'next-auth/react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Axios instance that auto-attaches the NextAuth JWT
const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

export default api;

// ── Leads ─────────────────────────────────────────────────────────────────
export const getLeads = (params?: Record<string, string | number>) =>
  api.get('/api/dashboard/leads', { params }).then((r) => r.data);

export const getLeadFilters = () =>
  api.get('/api/dashboard/leads/filters').then((r) => r.data);

export const getLead = (id: string) =>
  api.get(`/api/dashboard/leads/${id}`).then((r) => r.data);

export const updateLead = (id: string, data: Record<string, unknown>) =>
  api.patch(`/api/dashboard/leads/${id}`, data).then((r) => r.data);

export const deleteLead = (id: string) =>
  api.delete(`/api/dashboard/leads/${id}`).then((r) => r.data);

export const bulkStageLeads = (ids: string[], stage: string) =>
  api.post('/api/dashboard/leads/bulk-stage', { ids, stage }).then((r) => r.data);

export const bulkDeleteLeads = (ids: string[]) =>
  api.post('/api/dashboard/leads/bulk-delete', { ids }).then((r) => r.data);

export const exportLeadsCSV = () =>
  `${API_URL}/api/dashboard/leads/export/csv`;

// ── Stats ─────────────────────────────────────────────────────────────────
export const getStats = () =>
  api.get('/api/dashboard/stats').then((r) => r.data);

// ── Pipeline ──────────────────────────────────────────────────────────────
export const getPipeline = () =>
  api.get('/api/dashboard/pipeline').then((r) => r.data);

// ── Outreach ──────────────────────────────────────────────────────────────
export const generateEmail = (data: Record<string, unknown>) =>
  api.post('/api/dashboard/outreach/generate', data).then((r) => r.data);

export const sendEmail = (data: Record<string, unknown>) =>
  api.post('/api/dashboard/outreach/send', data).then((r) => r.data);

export const getSentEmails = (params?: Record<string, string | number>) =>
  api.get('/api/dashboard/outreach/sent', { params }).then((r) => r.data);

// ── Settings ──────────────────────────────────────────────────────────────
export const getSettings = () =>
  api.get('/api/dashboard/settings').then((r) => r.data);

export const updateSettings = (data: Record<string, unknown>) =>
  api.patch('/api/dashboard/settings', data).then((r) => r.data);

export const createJob = (data: Record<string, unknown>) =>
  api.post('/api/dashboard/settings/jobs', data).then((r) => r.data);

export const deleteJob = (id: string) =>
  api.delete(`/api/dashboard/settings/jobs/${id}`).then((r) => r.data);

// ── Sessions ──────────────────────────────────────────────────────────────
export const getSessions = (params?: Record<string, string | number>) =>
  api.get('/api/dashboard/sessions', { params }).then((r) => r.data);

export const getWorkerToken = () =>
  api.get('/api/dashboard/settings/worker-token').then((r) => r.data);

export const regenerateToken = () =>
  api.post('/api/dashboard/settings/regenerate-token').then((r) => r.data);
