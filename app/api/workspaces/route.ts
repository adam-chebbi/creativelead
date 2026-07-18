import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, extractSessionCookie } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    const sessionId = extractSessionCookie(req);
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Workspace name required" }, { status: 400 });
    }

    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        members: {
          create: { userId: auth.userId, role: "owner" },
        },
      },
    });

    if (sessionId) {
      await prisma.session.update({
        where: { id: sessionId },
        data: { workspaceId: workspace.id },
      });
    }

    return NextResponse.json({ workspace }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
