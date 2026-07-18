import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { workspaceId, userId } = await requireAuth(req);
    const batch = await req.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    let imported = 0;
    for (const item of batch) {
      const businessName = item.business_name || item.businessName;
      if (!businessName) continue;

      const phone = item.phone_number || item.phone || '';
      const existing = phone ? await prisma.lead.findFirst({
        where: { workspaceId, phone: phone },
      }) : null;

      if (existing) continue;

      await prisma.lead.create({
        data: {
          workspaceId,
          businessName,
          category: item.category || null,
          address: item.address || null,
          city: item.city || null,
          phone: phone || null,
          website: item.website || null,
          email: item.email || null,
          rating: item.rating != null ? Number(item.rating) : null,
          reviewCount: item.review_count != null ? Number(item.review_count) : null,
          latitude: item.latitude != null ? Number(item.latitude) : null,
          longitude: item.longitude != null ? Number(item.longitude) : null,
          pipelineStage: item._stage || 'new',
          createdById: userId,
        },
      });
      imported++;
    }

    return NextResponse.json({ count: imported });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
