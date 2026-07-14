import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../app/api/settings/integrations/route';
import { prisma } from '@/lib/prisma';

function makeGetRequest(): Request {
  return new Request('http://localhost/api/settings/integrations', { method: 'GET' });
}

describe('GET /api/settings/integrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns masked status for all integrations', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const item of body) {
      expect(item).toHaveProperty('slug');
      expect(item).toHaveProperty('configured');
      expect(item).toHaveProperty('masked');
      if (item.masked !== null) {
        expect(item.masked).toMatch(/^••••/);
      }
    }
  });

  it('returns 4 integration entries', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();
    expect(body).toHaveLength(4);
  });
});
