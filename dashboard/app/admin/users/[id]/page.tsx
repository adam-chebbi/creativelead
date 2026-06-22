import { requireRole } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@prisma/client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import UserDetailClient from './client';

export const dynamic = 'force-dynamic';

type Props = { params: { id: string } };

export default async function AdminUserDetailPage({ params }: Props) {
  const session = await requireRole(UserRole.ADMIN);

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    include: {
      scrapingSessions: { orderBy: { startedAt: 'desc' }, take: 10 },
      _count: { select: { businesses: true, scrapingSessions: true, sentEmails: true } },
    },
  });
  if (!user) notFound();

  const isSuperAdmin = session.user.role === UserRole.SUPER_ADMIN;

  return (
    <div>
      <Link href="/admin/users" className="text-sm mb-6 inline-flex items-center gap-1" style={{ color: '#6a9090' }}>
        ← Back to Users
      </Link>
      <UserDetailClient
        user={JSON.parse(JSON.stringify(user))}
        actorRole={session.user.role}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
}
