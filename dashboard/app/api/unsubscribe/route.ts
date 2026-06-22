import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase().trim();
  if (!email) return NextResponse.redirect(new URL('/unsubscribe?status=invalid', req.url));
  try {
    await prisma.business.updateMany({
      where: { email: { equals: email, mode: 'insensitive' } },
      data:  { unsubscribed: true, stage: 'Unsubscribed' },
    });
    return NextResponse.redirect(new URL(`/unsubscribe?status=ok&email=${encodeURIComponent(email)}`, req.url));
  } catch {
    return NextResponse.redirect(new URL('/unsubscribe?status=error', req.url));
  }
}
