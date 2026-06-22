import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/desktop/pending-auth?device_id=UUID
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const deviceId = searchParams.get('device_id');

  if (!deviceId) {
    return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
  }

  // Look for a recently used code for this device (within the last 2 minutes)
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  
  const recentAuth = await prisma.desktopAuthCode.findFirst({
    where: {
      deviceId,
      usedAt: { not: null, gte: twoMinutesAgo },
      userId: { not: null }
    },
    include: { user: true },
    orderBy: { usedAt: 'desc' }
  });

  if (recentAuth && recentAuth.user?.workerToken) {
    return NextResponse.json({ ready: true, token: recentAuth.user.workerToken });
  }

  // Check if there is an unredeemed code that HAS a user attached (completed OAuth, waiting to be exchanged)
  // The polling can also just return the token if the web app successfully attached the user.
  // Wait, if the desktop app polls this, it doesn't have the code. 
  // If the web app completed the flow but the deep link failed, the desktop polls this.
  // We can just redeem it automatically here if we find an unredeemed code with a user attached.
  const pendingAuth = await prisma.desktopAuthCode.findFirst({
    where: {
      deviceId,
      usedAt: null,
      userId: { not: null },
      expiresAt: { gt: new Date() }
    },
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  if (pendingAuth && pendingAuth.user) {
    let token = pendingAuth.user.workerToken;
    if (!token) {
      const { v4: uuidv4 } = require('uuid');
      token = uuidv4();
      await prisma.user.update({
        where: { id: pendingAuth.userId! },
        data: { workerToken: token }
      });
    }

    // Mark as used
    await prisma.desktopAuthCode.update({
      where: { id: pendingAuth.id },
      data: { usedAt: new Date() }
    });

    return NextResponse.json({ ready: true, token });
  }

  return NextResponse.json({ ready: false });
}
