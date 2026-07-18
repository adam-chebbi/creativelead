import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
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
    let workspaceId: string;
    try {
      const auth = await requireAuth(req);
      workspaceId = auth.workspaceId;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const row = await prisma.workspaceSettings.findUnique({
      where: { workspaceId },
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
    let workspaceId: string;
    try {
      const auth = await requireAuth(req);
      workspaceId = auth.workspaceId;
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { settings, updatedById } = body as {
      settings: Record<string, unknown>;
      updatedById?: string;
    };

    if (!settings) {
      return NextResponse.json({ error: 'settings are required' }, { status: 400 });
    }

    const row = await prisma.workspaceSettings.upsert({
      where: { workspaceId },
      update: { settings: settings as unknown as Prisma.InputJsonValue, updatedById: updatedById || null },
      create: { workspaceId, settings: settings as unknown as Prisma.InputJsonValue, updatedById: updatedById || null },
    });

    return NextResponse.json({ ok: true, id: row.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
