import { NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const hash = crypto.createHash("sha256").update(code).digest("hex");
    const expected = process.env.ACCESS_CODE_HASH;

    if (hash !== expected) {
      return NextResponse.json({ success: false }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set("cl_session", hash, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
