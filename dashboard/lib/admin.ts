import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

const ROLE_WEIGHT: Record<string, number> = {
  USER:        1,
  ADMIN:       2,
  SUPER_ADMIN: 3,
};

// ── Server-side role guard ─────────────────────────────────────
export async function requireRole(minRole: UserRole) {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  const weight = ROLE_WEIGHT[session.user.role ?? 'USER'] ?? 0;
  if (weight < ROLE_WEIGHT[minRole]) redirect('/403');
  return session;
}

// ── Role check for API route handlers (throws, doesn't redirect) ──
export function assertRole(sessionRole: UserRole | undefined, minRole: UserRole) {
  const weight = ROLE_WEIGHT[sessionRole ?? 'USER'] ?? 0;
  if (weight < ROLE_WEIGHT[minRole]) {
    throw new Error('FORBIDDEN');
  }
}

// ── Append-only audit log writer ──────────────────────────────
export async function writeAuditLog(
  actorId: string,
  actorEmail: string,
  action: string,
  targetId?: string | null,
  metadata?: Record<string, unknown>
) {
  await prisma.auditLog.create({
    data: {
      actorId,
      actorEmail,
      action,
      targetId: targetId ?? null,
      metadata: metadata ?? null,
    },
  });
}
