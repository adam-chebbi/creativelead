import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export function requireRole(_role: string): {
  userId: string;
  orgId: string;
} {
  const session = getSession();
  if (!session) {
    throw NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}
