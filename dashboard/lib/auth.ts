import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/auth/login');
  return session;
}

export async function getOptionalSession() {
  return getServerSession(authOptions);
}
