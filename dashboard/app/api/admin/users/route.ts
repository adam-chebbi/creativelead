import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { assertRole } from '@/lib/admin';
import { UserRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  try { assertRole(session?.user.role, UserRole.ADMIN); } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page    = Math.max(1, parseInt(searchParams.get('page')  ?? '1'));
  const perPage = Math.min(100, parseInt(searchParams.get('per')  ?? '25'));
  const search  = searchParams.get('search') ?? '';
  const role    = searchParams.get('role')   as UserRole | null;

  const where = {
    ...(search ? { email: { contains: search, mode: 'insensitive' as const } } : {}),
    ...(role ? { role } : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip:  (page - 1) * perPage,
      take:  perPage,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, role: true, suspended: true,
        createdAt: true, lastActiveAt: true,
        _count: { select: { businesses: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, page, perPage });
}
