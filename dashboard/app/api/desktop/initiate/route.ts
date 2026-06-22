import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// GET /api/desktop/initiate?device_id=UUID
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const deviceId = searchParams.get('device_id');

  if (!deviceId) {
    return NextResponse.json({ error: 'device_id is required' }, { status: 400 });
  }

  // Create an initial auth intent record. User is not attached yet.
  // The code itself isn't used until after login, but we create the record to 
  // track that a device started the flow.
  
  // Clean up old expired codes for this device to prevent bloat
  await prisma.desktopAuthCode.deleteMany({
    where: { deviceId, expiresAt: { lt: new Date() } }
  }).catch(() => {});

  // Generate a random code. It will be sent via deep link later.
  const code = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes TTL

  await prisma.desktopAuthCode.create({
    data: {
      code,
      deviceId,
      expiresAt,
    }
  });

  return NextResponse.json({ ok: true });
}
