import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireAuth } from '@/lib/auth';
import { requireRole } from '@/lib/requireRole';
import { z } from 'zod';

const indexedDbLeadSchema = z.object({
  businessName: z.string().optional(),
  business_name: z.string().optional(),
  category: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  phone_number: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  rating: z.number().optional().nullable(),
  reviewCount: z.number().optional().nullable(),
  review_count: z.number().optional().nullable(),
  aiScore: z.number().optional().nullable(),
  classification: z.string().optional().nullable(),
  pipelineStage: z.string().optional().nullable(),
}).passthrough();

const batchSchema = z.array(indexedDbLeadSchema).max(200, 'Maximum 200 leads per batch');

export async function POST(req: Request) {
  let caller: { userId: string; orgId: string };
  try {
    caller = await requireAuth(req);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large. Max 5 MB per batch.' }, { status: 413 });
  }

  try {
    const body = await req.json();
    const leads = batchSchema.parse(body);

    const CONCURRENCY = 10;
    const results: boolean[] = [];

    for (let i = 0; i < leads.length; i += CONCURRENCY) {
      const batch = leads.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (lead) => {
          const businessName = lead.businessName ?? lead.business_name ?? 'Unknown';
          const phone = lead.phone ?? lead.phone_number ?? null;
          try {
            await prisma.lead.upsert({
              where: {
                organizationId_phone: {
                  organizationId: caller.orgId,
                  phone: phone ?? '__no_phone__',
                },
              },
              update: {},
              create: {
                organizationId: caller.orgId,
                createdById: caller.userId,
                businessName,
                category: lead.category,
                address: lead.address,
                city: lead.city,
                phone: phone,
                website: lead.website,
                email: lead.email,
                rating: lead.rating,
                reviewCount: lead.reviewCount ?? lead.review_count,
                aiScore: lead.aiScore,
                classification: lead.classification,
                pipelineStage: lead.pipelineStage ?? 'new',
              },
            });
            return true;
          } catch {
            return false;
          }
        })
      );
      results.push(...batchResults.map((r) => r.status === 'fulfilled' && r.value));
    }

    const importedCount = results.filter(Boolean).length;

    await prisma.auditLog.create({
      data: {
        organizationId: caller.orgId,
        actorId: caller.userId,
        action: 'leads.migration_batch',
        metadata: { attempted: leads.length, imported: importedCount },
      },
    });

    return NextResponse.json({ success: true, count: importedCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('[MIGRATE_IMPORT]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
