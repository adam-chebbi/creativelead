import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getDailyCounters, getCounterHistory } from "@/lib/quota";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    const [daily, history] = await Promise.all([
      getDailyCounters(auth.workspaceId),
      getCounterHistory(auth.workspaceId, 30),
    ]);
    return NextResponse.json({ workspaceId: auth.workspaceId, daily, history });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
