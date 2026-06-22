import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertRole, writeAuditLog } from '@/lib/admin';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/admin/flags — list all feature flags
export async function GET() {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  return NextResponse.json(flags);
}

// PATCH /api/admin/flags — toggle or upsert a feature flag
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { key, enabled, description } = body as {
    key: string; enabled: boolean; description?: string;
  };

  if (!key || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'key and enabled are required' }, { status: 400 });
  }

  const flag = await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled, ...(description !== undefined ? { description } : {}) },
    create: { key, enabled, description },
  });

  await writeAuditLog(
    session!.user.id, session!.user.email!,
    enabled ? 'FLAG_ENABLED' : 'FLAG_DISABLED',
    null,
    { key }
  );

  return NextResponse.json(flag);
}
