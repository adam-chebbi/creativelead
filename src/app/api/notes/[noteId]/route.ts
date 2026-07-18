import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function DELETE(req: NextRequest, { params }: { params: { noteId: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const note = await prisma.leadNote.findFirst({
      where: { id: params.noteId, lead: { workspaceId } },
    });
    if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.leadNote.delete({ where: { id: params.noteId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
