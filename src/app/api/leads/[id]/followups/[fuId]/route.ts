import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: { id: string; fuId: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const fu = await prisma.followUp.findFirst({
      where: { id: params.fuId, lead: { workspaceId } },
    });
    if (!fu) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.followUp.delete({ where: { id: params.fuId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string; fuId: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const fu = await prisma.followUp.findFirst({
      where: { id: params.fuId, lead: { workspaceId } },
    });
    if (!fu) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.completed !== undefined) data.status = body.completed ? 'completed' : 'pending';
    await prisma.followUp.update({ where: { id: params.fuId }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
