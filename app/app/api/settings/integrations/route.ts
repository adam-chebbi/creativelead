import { NextResponse } from 'next/server';
import { prisma } from "@/lib/prisma";
import { requireAuth } from '@/lib/auth';
import { hasSecret, maskSecret, getSecret, setSecret, SecretKey } from '@/lib/secrets';
import { requireRole } from '@/lib/requireRole';
import { z } from 'zod';

const INTEGRATION_KEYS = ['ai/openai', 'ai/gemini', 'smtp', 'twilio'] as const;
type IntegrationSlug = typeof INTEGRATION_KEYS[number];

export async function GET(req: Request) {
  let caller: { userId: string; orgId: string };
  try {
    caller = await requireAuth(req);
  } catch (err) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const statuses = await Promise.all(
      INTEGRATION_KEYS.map(async (slug) => {
        const key: SecretKey = `org/${caller.orgId}/${slug}`;
        const value = await getSecret(key);
        return {
          slug,
          configured: value !== null && value.length > 0,
          masked: maskSecret(value),
        };
      })
    );

    return NextResponse.json(statuses);
  } catch (error) {
    console.error('[INTEGRATIONS_GET]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}

const integrationUpdateSchema = z.object({
  slug: z.enum(['ai/openai', 'ai/gemini', 'smtp', 'twilio']),
  value: z.string().min(1, 'Secret value cannot be empty'),
}).strict();

export async function POST(req: Request) {
  let caller: { userId: string; orgId: string };
  try {
    caller = requireRole('org:admin');
  } catch (response) {
    return response as NextResponse;
  }

  try {
    const body = await req.json();
    const { slug, value } = integrationUpdateSchema.parse(body);

    const key: SecretKey = `org/${caller.orgId}/${slug}`;
    await setSecret(key, value);

    await prisma.auditLog.create({
      data: {
        organizationId: caller.orgId,
        actorId: caller.userId,
        action: 'settings.integration_updated',
        targetType: 'integration',
        targetId: slug,
        metadata: { slug },
      },
    });

    return NextResponse.json({ success: true, masked: maskSecret(value) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('[INTEGRATIONS_POST]', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
