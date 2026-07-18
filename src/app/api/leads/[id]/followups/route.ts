import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { workspaceId } = await requireAuth(req);
    const lead = await prisma.lead.findFirst({ where: { id: params.id, workspaceId } });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const followUps = await prisma.followUp.findMany({
      where: { leadId: params.id },
      orderBy: { dueAt: 'asc' },
    });
    return NextResponse.json(followUps);
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
    const fu = await prisma.followUp.create({
      data: {
        leadId: params.id,
        dueAt: new Date(body.dueAt),
        assignedToId: userId,
        status: body.completed ? 'completed' : 'pending',
      },
    });
    return NextResponse.json(fu, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
