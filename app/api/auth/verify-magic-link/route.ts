import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.redirect(new URL("/sign-in?error=invalid_token", req.url));
    }

    const record = await prisma.verificationToken.findUnique({ where: { token } });
    if (!record || record.expiresAt < new Date()) {
      return NextResponse.redirect(new URL("/sign-in?error=expired", req.url));
    }

    // Delete the used token
    await prisma.verificationToken.delete({ where: { id: record.id } });

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: record.email } });
    if (!user) {
      user = await prisma.user.create({
        data: { email: record.email },
      });

      // First user: check for existing ws_default workspace (Phase 0 migration path)
      const existingWorkspace = await prisma.workspace.findUnique({ where: { id: "ws_default" } });
      if (existingWorkspace) {
        // Attach user to the existing default workspace as owner
        await prisma.workspaceMember.create({
          data: { workspaceId: "ws_default", userId: user.id, role: "owner" },
        });
      } else {
        // Create fresh workspace
        await prisma.workspace.create({
          data: {
            id: "ws_default",
            name: `${record.email.split("@")[0]}'s Workspace`,
            members: { create: { userId: user.id, role: "owner" } },
          },
        });
      }
    }

    // Get user's workspaces
    let memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    if (memberships.length === 0) {
      const existingWorkspace = await prisma.workspace.findUnique({ where: { id: "ws_default" } });
      if (existingWorkspace) {
        await prisma.workspaceMember.create({
          data: { workspaceId: "ws_default", userId: user.id, role: "owner" },
        });
      } else {
        await prisma.workspace.create({
          data: {
            id: "ws_default",
            name: `${record.email.split("@")[0]}'s Workspace`,
            members: { create: { userId: user.id, role: "owner" } },
          },
        });
      }
      memberships = await prisma.workspaceMember.findMany({
        where: { userId: user.id },
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
      });
    }

    const targetWorkspaceId = memberships[0].workspaceId;

    // Create session (7 day expiry)
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        workspaceId: targetWorkspaceId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Set session cookie
    const response = NextResponse.redirect(new URL("/import", req.url));
    response.cookies.set("cl_session", session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=server_error", req.url));
  }
}
