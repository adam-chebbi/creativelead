import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertRole, writeAuditLog } from '@/lib/admin';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

type Ctx = { params: { id: string } };

// POST /api/admin/users/[id]/impersonate — SUPER_ADMIN only
// Returns a redirect instruction; the client calls update() on the session
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.SUPER_ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden: requires SUPER_ADMIN' }, { status: 403 });
  }

  const target = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, role: true },
  });
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await writeAuditLog(
    session!.user.id,
    session!.user.email!,
    'IMPERSONATION_START',
    target.id,
    { targetEmail: target.email }
  );

  // The client should call useSession().update() with this payload
  return NextResponse.json({
    ok: true,
    impersonateUserId: target.id,
    impersonatedBy: session!.user.email,
  });
}
