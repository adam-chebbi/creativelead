import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

const SECRET_FIELDS = [
  'geminiApiKey', 'openAiKey', 'openrouterApiKey', 'groqApiKey',
  'anthropicApiKey', 'mistralApiKey', 'cohereApiKey', 'customApiKey',
  'enrichmentKey', 'emailSmtpPass', 'gmailAppPassword', 'resendApiKey',
  'emailSmtpUser', 'twilioAccountSid', 'twilioAuthToken',
  'twilioSmsFromNumber', 'twilioWhatsAppFromNumber',
] as const;

function maskValue(val: unknown): unknown {
  if (typeof val === 'string' && val.length > 4) return `••••${val.slice(-4)}`;
  if (typeof val === 'string' && val.length > 0) return '••••';
  return val;
}

function maskSecrets(settings: Record<string, unknown>): Record<string, unknown> {
  const masked = { ...settings };
  for (const field of SECRET_FIELDS) {
    if (field in masked) {
      masked[field] = maskValue(masked[field]);
    }
  }
  return masked;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');
    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId query param is required' }, { status: 400 });
    }

    const row = await prisma.organizationSettings.findUnique({
      where: { organizationId },
    });

    if (!row) {
      return NextResponse.json({ settings: null });
    }

    return NextResponse.json({ settings: maskSecrets(row.settings as unknown as Record<string, unknown>) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, settings, updatedById } = body as {
      organizationId: string;
      settings: Record<string, unknown>;
      updatedById?: string;
    };

    if (!organizationId || !settings) {
      return NextResponse.json({ error: 'organizationId and settings are required' }, { status: 400 });
    }

    const row = await prisma.organizationSettings.upsert({
      where: { organizationId },
      update: { settings: settings as unknown as Prisma.InputJsonValue, updatedById: updatedById || null },
      create: { organizationId, settings: settings as unknown as Prisma.InputJsonValue, updatedById: updatedById || null },
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
