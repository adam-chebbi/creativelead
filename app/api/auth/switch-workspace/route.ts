import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, extractSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    const sessionId = extractSessionCookie(req);
    if (!sessionId) {
      return NextResponse.json({ error: "No session" }, { status: 401 });
    }

    const { workspaceId } = await req.json();
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: auth.userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { workspaceId },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
