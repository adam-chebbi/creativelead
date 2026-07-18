import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
    const { host, port, secure, user, pass, from, fromName, to, subject, text } = await req.json();

    if (!host || !user || !pass || !from || !to || !subject || !text) {
      return NextResponse.json({ error: 'Missing required fields: host, user, pass, from, to, subject, text' }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      host,
      port: port || 587,
      secure: secure ?? port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: fromName ? `"${fromName}" <${from}>` : from,
      to,
      subject,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
