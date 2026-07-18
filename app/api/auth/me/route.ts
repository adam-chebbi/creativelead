import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: auth.userId },
      include: { workspace: true },
    });

    return NextResponse.json({
      authenticated: true,
      user: { id: auth.userId, email: auth.userEmail },
      activeWorkspaceId: auth.workspaceId,
      workspaces: memberships.map(m => ({
        id: m.workspace.id,
        name: m.workspace.name,
        role: m.role,
      })),
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
