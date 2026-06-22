import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const workerToken  = crypto.randomBytes(32).toString('hex');
    const user = await prisma.user.create({
      data: { email, passwordHash, name: name || email.split('@')[0], workerToken },
    });
    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch (err) {
    console.error('[signup]', err);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
