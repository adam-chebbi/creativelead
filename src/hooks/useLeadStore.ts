import { useCallback } from 'react';
import { Lead } from '@/types';
import { apiRequest } from '@/utils/api-request';

// ── Server-side API fetch ────────────────────────────────────────────────────
// Fetches leads from the authenticated API route (Postgres-backed).
// Falls back to an empty array if the API is unavailable or returns an error.
export async function fetchLeadsFromApi(params?: Record<string, string>): Promise<Lead[]> {
  try {
    const url = new URL('/api/leads', window.location.origin);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    const res = await apiRequest(url.toString());
    if (!res.ok) {
      console.warn(`[useLeadStore] API returned ${res.status} — is the database set up?`);
      return [];
    }
    const data = await res.json();
    // Normalise server Lead shape → client Lead shape
    return (data as ServerLead[]).map(normaliseServerLead);
  } catch (err) {
    console.warn('[useLeadStore] Failed to fetch from API:', err);
    return [];
  }
}

// The API returns Prisma's camelCase shape; the client expects the extension's snake_case shape
interface ServerLead {
  id: string;
  businessName: string;
  category?: string | null;
  address?: string | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  aiScore?: number | null;
  classification?: string | null;
  pipelineStage?: string;
  ownerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function normaliseServerLead(s: ServerLead): Lead {
  return {
    business_name: s.businessName,
    category: s.category ?? '',
    address: s.address ?? '',
    city: s.city ?? '',
    phone_number: s.phone ?? null,
    website: s.website ?? null,
    email: s.email ?? null,
    rating: s.rating ?? null,
    review_count: s.reviewCount ?? null,
    ai_score: s.aiScore ?? null,
    classification: (s.classification as Lead['classification']) ?? null,
    _stage: (s.pipelineStage as Lead['_stage']) ?? 'new',
    // Required fields with safe defaults
    google_maps_url: `server:${s.id}`,
    _serverId: s.id,
  } as Lead;
}

export async function patchLeadOnServer(serverId: string, data: Partial<Lead>): Promise<void> {
  try {
    await apiRequest(`/api/leads/${serverId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch (err) {
    console.warn('[useLeadStore] PATCH failed:', err);
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useLeadStore() {
  const getAllLeads = useCallback(async (params?: Record<string, string>): Promise<Lead[]> => {
    return fetchLeadsFromApi(params);
  }, []);

  // saveLeads is now handled by the ImportPage → /api/leads/bulk-import route directly.
  // This stub is kept for compatibility with legacy call-sites during transition.
  const saveLeads = useCallback(async (leads: Lead[]): Promise<void> => {
    console.warn('[useLeadStore] saveLeads called — use /api/leads/bulk-import instead.');
  }, []);

  const updateLead = useCallback(async (urlOrId: string, data: Partial<Lead>): Promise<void> => {
    // Extract server ID from the synthetic google_maps_url (format: "server:{id}")
    const serverId = urlOrId.startsWith('server:') ? urlOrId.slice(7) : urlOrId;
    if (serverId) {
      await patchLeadOnServer(serverId, data);
    }
  }, []);

  const deleteLeads = useCallback(async (_urlOrIds: string[]): Promise<void> => {
    // TODO: implement DELETE /api/leads bulk endpoint
    console.warn('[useLeadStore] deleteLeads not yet implemented server-side.');
  }, []);

  return { getAllLeads, saveLeads, updateLead, deleteLeads };
}
