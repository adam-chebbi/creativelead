import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertRole, writeAuditLog } from '@/lib/admin';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type Ctx = { params: { id: string } };

const ROLE_WEIGHT: Record<string, number> = {
  USER: 1, ADMIN: 2, SUPER_ADMIN: 3,
};

// GET /api/admin/users/[id] — user detail
export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      scrapingSessions: { orderBy: { startedAt: 'desc' }, take: 10 },
      _count: { select: { businesses: true, scrapingSessions: true } },
    },
  });
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}

// PATCH /api/admin/users/[id] — change role or suspend/reinstate
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const { role, suspended } = body as { role?: UserRole; suspended?: boolean };

  // Prevent non-SUPER_ADMIN from touching SUPER_ADMIN accounts
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const actorWeight  = ROLE_WEIGHT[session!.user.role] ?? 0;
  const targetWeight = ROLE_WEIGHT[target.role] ?? 0;
  if (targetWeight >= ROLE_WEIGHT.SUPER_ADMIN && actorWeight < ROLE_WEIGHT.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Cannot modify a SUPER_ADMIN' }, { status: 403 });
  }

  const updated = await prisma.user.update({
    where: { id: params.id },
    data: {
      ...(role !== undefined ? { role } : {}),
      ...(suspended !== undefined ? { suspended } : {}),
    },
    select: { id: true, email: true, role: true, suspended: true },
  });

  const action = role !== undefined ? 'ROLE_CHANGE' : suspended ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REINSTATED';
  await writeAuditLog(session!.user.id, session!.user.email!, action, params.id, { role, suspended });

  return NextResponse.json(updated);
}

// DELETE /api/admin/users/[id] — delete user and all data
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { role: true, email: true } });
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const actorWeight  = ROLE_WEIGHT[session!.user.role] ?? 0;
  const targetWeight = ROLE_WEIGHT[target.role] ?? 0;
  if (targetWeight >= ROLE_WEIGHT.SUPER_ADMIN && actorWeight < ROLE_WEIGHT.SUPER_ADMIN) {
    return NextResponse.json({ error: 'Cannot delete a SUPER_ADMIN' }, { status: 403 });
  }

  await writeAuditLog(session!.user.id, session!.user.email!, 'ACCOUNT_DELETED', params.id, { email: target.email });
  await prisma.user.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
