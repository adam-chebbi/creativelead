import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../../app/api/leads/bulk-import/route';
import { prisma } from '@/lib/prisma';

const validLead = {
  business_name: 'Acme Pizza',
  category: 'Restaurant',
  city: 'London',
  phone_number: '07700900000',
  website: 'https://acme.com',
  email: 'info@acme.com',
  rating: 4.5,
  review_count: 42,
};

function makeRequest(body: unknown, extraHeaders: Record<string, string> = {}): Request {
  const json = JSON.stringify(body);
  return new Request('http://localhost/api/leads/bulk-import', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': String(Buffer.byteLength(json)),
      ...extraHeaders,
    },
    body: json,
  });
}

describe('POST /api/leads/bulk-import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.lead.create).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  });

  it('successfully imports valid leads', async () => {
    const res = await POST(makeRequest([validLead]));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
  });

  it('rejects unknown fields (strict Zod schema)', async () => {
    const withExtraField = { ...validLead, hacked_field: '<script>alert(1)</script>' };
    const res = await POST(makeRequest([withExtraField]));
    expect(res.status).toBe(400);
  });

  it('rejects invalid email format', async () => {
    const badEmail = { ...validLead, email: 'not-an-email' };
    const res = await POST(makeRequest([badEmail]));
    expect(res.status).toBe(400);
  });

  it('rejects payloads over 500 leads', async () => {
    const tooMany = Array.from({ length: 501 }, () => validLead);
    const res = await POST(makeRequest(tooMany));
    expect(res.status).toBe(400);
  });

  it('rejects oversized payloads via content-length', async () => {
    const res = await POST(makeRequest([validLead], { 'Content-Length': String(6 * 1024 * 1024) }));
    expect(res.status).toBe(413);
  });

  it('writes an audit log entry on success', async () => {
    await POST(makeRequest([validLead]));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'leads.bulk_import' }),
      })
    );
  });
});
