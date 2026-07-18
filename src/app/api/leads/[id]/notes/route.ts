import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const lead = await prisma.lead.findFirst({ where: { id: params.id, workspaceId } });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const notes = await prisma.leadNote.findMany({
      where: { leadId: params.id },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(notes);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { userId, workspaceId } = await requireAuth(req);
    const lead = await prisma.lead.findFirst({ where: { id: params.id, workspaceId } });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const body = await req.json();
    const note = await prisma.leadNote.create({
      data: {
        leadId: params.id,
        authorId: userId,
        body: body.body || body.text || '',
      },
    });
    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
