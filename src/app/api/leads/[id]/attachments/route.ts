import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const lead = await prisma.lead.findFirst({ where: { id: params.id, workspaceId } });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const attachments = await prisma.leadAttachment.findMany({
      where: { leadId: params.id },
    });
    return NextResponse.json(attachments);
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
    const att = await prisma.leadAttachment.create({
      data: {
        leadId: params.id,
        fileUrl: body.data || body.fileUrl || '',
        uploadedById: userId,
      },
    });
    return NextResponse.json(att, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
