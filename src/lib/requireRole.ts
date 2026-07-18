import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { AuthContext } from "@/lib/auth";

export function extractSessionId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/cl_session=([^;]+)/);
  return match ? match[1] : null;
}

export async function requireRole(req: Request, allowedRoles: ("owner" | "member")[]): Promise<AuthContext> {
  const sessionId = extractSessionId(req);
  if (!sessionId) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: session.workspaceId,
        userId: session.userId,
      },
    },
  });

  if (!membership) {
    throw NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!allowedRoles.includes(membership.role as "owner" | "member")) {
    throw NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    role: membership.role as "owner" | "member",
    userEmail: session.user.email,
  };
}
