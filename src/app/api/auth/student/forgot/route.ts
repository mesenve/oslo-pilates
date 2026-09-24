import { sendPasswordResetEmail } from "@/lib/email";
import { findActivatedInviteByEmail } from "@/lib/server/invite-store";
import {
  createPasswordResetToken,
  passwordResetUrl,
} from "@/lib/server/password-reset";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim() ?? "";

  // Always return the same response to avoid account enumeration.
  const ok = NextResponse.json({
    ok: true,
    message:
      "E-posta kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.",
  });

  if (!email) return ok;

  try {
    const invite = await findActivatedInviteByEmail(email);
    if (!invite?.password) return ok;

    const origin = new URL(request.url).origin;
    const token = createPasswordResetToken(invite.student.id, invite.student.email);
    const resetUrl = passwordResetUrl(token, process.env.NEXT_PUBLIC_APP_URL || origin);
    await sendPasswordResetEmail(
      { name: invite.student.name, email: invite.student.email },
      resetUrl,
    );
  } catch (error) {
    console.error("Student password reset request failed:", error);
  }

  return ok;
}
