import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/desktop/exchange
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code, device_id } = body;

    if (!code || !device_id) {
      return NextResponse.json({ error: 'code and device_id are required' }, { status: 400 });
    }

    // Rate limiting should be handled by middleware or Express API, but this is Next.js API route.
    // For now, Next.js route limiters are usually in middleware or external. We will rely on Express if we move this, but currently it's in Next.js.
    // Actually the blueprint says "dashboard/app/api/desktop/exchange/route.ts" so we'll do it here.

    const authCode = await prisma.desktopAuthCode.findUnique({
      where: { code }
    });

    if (!authCode) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }

    if (authCode.deviceId !== device_id) {
      return NextResponse.json({ error: 'Device mismatch' }, { status: 400 });
    }

    if (authCode.usedAt) {
      return NextResponse.json({ error: 'Code already used' }, { status: 400 });
    }

    if (authCode.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Code expired' }, { status: 400 });
    }

    if (!authCode.userId) {
      return NextResponse.json({ error: 'Auth not completed by user' }, { status: 400 });
    }

    // Ensure workerToken exists for this user
    let token = null;
    const user = await prisma.user.findUnique({ where: { id: authCode.userId } });
    if (user) token = user.workerToken;
    if (!token) {
      // In case the user doesn't have a worker token yet, generate one
      const { randomBytes } = await import('crypto');
      token = randomBytes(32).toString('hex');
      await prisma.user.update({
        where: { id: authCode.userId },
        data: { workerToken: token }
      });
    }

    // Mark code as used
    await prisma.desktopAuthCode.update({
      where: { id: authCode.id },
      data: { usedAt: new Date() }
    });

    return NextResponse.json({ token });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
