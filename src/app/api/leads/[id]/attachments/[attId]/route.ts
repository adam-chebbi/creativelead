import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: { id: string; attId: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const att = await prisma.leadAttachment.findFirst({
      where: { id: params.attId, lead: { workspaceId } },
    });
    if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.leadAttachment.delete({ where: { id: params.attId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
