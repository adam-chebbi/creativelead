import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireAuth } from '@/lib/auth';
import { rateLimit } from '@/lib/rateLimit';
import { z } from 'zod';

const leadSchema = z.object({
  business_name: z.string(),
  category: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  rating: z.number().min(0).max(5).optional().nullable(),
  review_count: z.number().int().min(0).optional().nullable(),
});

const bulkImportSchema = z.array(leadSchema).max(500, 'Maximum 500 leads per import');

export async function POST(req: Request) {
  let userId, orgId;
  try {
    const authContext = await requireAuth(req);
    userId = authContext.userId;
    orgId = authContext.orgId;
  } catch (err) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const rl = rateLimit({ key: `bulk-import:${userId}`, limit: 10, windowMs: 60_000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many requests. Try again in a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large. Max 5 MB per import.' }, { status: 413 });
  }

  try {
    const body = await req.json();
    const leads = bulkImportSchema.parse(body);

    const createdLeads = await Promise.allSettled(
      leads.map((lead) =>
        prisma.lead.create({
          data: {
            organizationId: orgId,
            createdById: userId,
            businessName: lead.business_name,
            category: lead.category,
            address: lead.address,
            city: lead.city,
            phone: lead.phone_number,
            website: lead.website,
            email: lead.email,
            rating: lead.rating,
            reviewCount: lead.review_count,
          },
        })
      )
    );

    const successful = createdLeads.filter((r) => r.status === 'fulfilled').length;

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        actorId: userId,
        action: 'leads.bulk_import',
        metadata: { attempted: leads.length, imported: successful },
      },
    });

    return NextResponse.json({ success: true, count: successful });
  } catch (error) {
    console.error('[LEADS_BULK_IMPORT]', error);
    console.error("[LEADS_BULK_IMPORT_STACK]", error instanceof Error ? error.stack : JSON.stringify(error));
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
