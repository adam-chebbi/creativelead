import { NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const token = crypto.randomBytes(32).toString("hex");

    // Delete any previous tokens for this email
    await prisma.verificationToken.deleteMany({ where: { email: normalized } });

    await prisma.verificationToken.create({
      data: {
        email: normalized,
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      },
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const magicLink = `${origin}/api/auth/verify-magic-link?token=${token}`;

    // Try sending email; silently fall back to console if no SMTP configured
    try {
      const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_SMTP_HOST;
      const smtpPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_SMTP_PORT || "587", 10);
      const smtpUser = process.env.SMTP_USER || process.env.EMAIL_SMTP_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_SMTP_PASS;
      const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_FROM || "noreply@creativelead.app";

      if (smtpHost && smtpUser && smtpPass) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
        });

        await transporter.sendMail({
          from: fromEmail,
          to: normalized,
          subject: "Sign in to CreativeLead",
          text: `Here is your sign-in link:\n\n${magicLink}\n\nThis link expires in 15 minutes.`,
          html: `<p>Here is your sign-in link:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 15 minutes.</p>`,
        });
      } else {
        console.log(`[MAGIC LINK] For ${normalized}: ${magicLink}`);
      }
    } catch (sendErr) {
      console.warn("[MAGIC LINK] Email send failed, link available in server logs:", sendErr);
      console.log(`[MAGIC LINK] For ${normalized}: ${magicLink}`);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
