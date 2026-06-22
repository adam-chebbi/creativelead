import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import DesktopAuthClient from './client';

export const dynamic = 'force-dynamic';

export default async function DesktopAuthPage({
  searchParams,
}: {
  searchParams: { device_id?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login?source=desktop&device_id=' + (searchParams.device_id || ''));
  }

  const deviceId = searchParams.device_id;
  if (!deviceId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080f0f] text-white">
        <p>Invalid request: Missing device_id.</p>
      </div>
    );
  }

  // Find the pending auth code for this device
  const authCode = await prisma.desktopAuthCode.findFirst({
    where: {
      deviceId,
      userId: null,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!authCode) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080f0f] text-white">
        <p className="text-center">
          Authentication session expired or not found. <br />
          Please try logging in from the desktop app again.
        </p>
      </div>
    );
  }

  // Link the user to the auth code
  await prisma.desktopAuthCode.update({
    where: { id: authCode.id },
    data: { userId: session.user.id },
  });

  // Render client component to handle the deep link redirect
  return <DesktopAuthClient code={authCode.code} />;
}
