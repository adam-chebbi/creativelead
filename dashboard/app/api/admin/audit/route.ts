import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertRole } from '@/lib/admin';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/admin/audit?page=1&per=50
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page    = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const perPage = Math.min(100, parseInt(searchParams.get('per') ?? '50'));

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      skip:    (page - 1) * perPage,
      take:    perPage,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.auditLog.count(),
  ]);

  return NextResponse.json({ logs, total, page, perPage });
}
