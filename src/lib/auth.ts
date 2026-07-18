import { prisma } from "@/lib/prisma";

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: "owner" | "member";
  userEmail: string;
}

export function extractSessionCookie(req?: Request): string | null {
  if (!req) return null;
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/cl_session=([^;]+)/);
  return match ? match[1] : null;
}

export async function requireAuth(req?: Request): Promise<AuthContext> {
  const sessionId = extractSessionCookie(req);
  if (!sessionId) {
    throw new Error("Unauthorized");
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw new Error("Unauthorized");
  }

  const membership = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: session.workspaceId,
        userId: session.userId,
      },
    },
  });

  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    role: (membership?.role as "owner" | "member") || "member",
    userEmail: session.user.email,
  };
}

export function getSession(req?: Request): AuthContext | null {
  return null; // Synchronous fallback — use requireAuth for async
}
