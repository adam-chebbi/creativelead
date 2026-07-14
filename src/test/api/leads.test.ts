import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../app/api/leads/route';
import { prisma } from '@/lib/prisma';

function makeGetRequest(params: Record<string, string> = {}): Request {
  const url = new URL('http://localhost/api/leads');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString(), { method: 'GET' });
}

const mockLeads = [
  { id: 'lead_1', organizationId: 'org_456', businessName: 'Acme Pizza' },
  { id: 'lead_2', organizationId: 'org_456', businessName: 'Bob Burgers' },
];

describe('GET /api/leads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.findMany).mockResolvedValue(mockLeads as never);
  });

  it('returns leads', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);
  });

  it('applies stage filter when provided', async () => {
    await GET(makeGetRequest({ stage: 'qualified' }));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pipelineStage: 'qualified' }),
      })
    );
  });

  it('applies owner filter when provided', async () => {
    await GET(makeGetRequest({ owner: 'user_abc' }));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownerId: 'user_abc' }),
      })
    );
  });

  it('applies text search filter when q is provided', async () => {
    await GET(makeGetRequest({ q: 'pizza' }));
    expect(prisma.lead.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    );
  });
});
