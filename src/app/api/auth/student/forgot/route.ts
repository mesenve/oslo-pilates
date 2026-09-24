import { sendPasswordResetEmail } from "@/lib/email";
import { getStaffByEmail } from "@/data/staff";
import { findActivatedInviteByEmail } from "@/lib/server/invite-store";
import {
  createPasswordResetToken,
  passwordResetUrl,
} from "@/lib/server/password-reset";
import { getSessionUser } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim() ?? "";
  const sessionUser = await getSessionUser();
  const isAdmin =
    sessionUser?.role === "super_admin" || sessionUser?.role === "instructor";

  // Public callers always get the same response to avoid account enumeration.
  const ok = NextResponse.json({
    ok: true,
    message:
      "Talep alındı. E-posta kayıtlıysa kısa süre içinde sıfırlama bağlantısı gelir. Gelen kutunu ve spam klasörünü kontrol et.",
  });

  if (!email) {
    if (isAdmin) {
      return NextResponse.json({ error: "E-posta gerekli." }, { status: 400 });
    }
    return ok;
  }

  try {
    const origin = new URL(request.url).origin;
    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || origin;

    const invite = await findActivatedInviteByEmail(email);
    if (invite?.password) {
      const token = await createPasswordResetToken(
        "student",
        invite.student.id,
        invite.student.email,
      );
      const resetUrl = passwordResetUrl(token, appOrigin);
      const sent = await sendPasswordResetEmail(
        { name: invite.student.name, email: invite.student.email },
        resetUrl,
      );
      if (!sent.ok) {
        console.error("Password reset email failed:", sent.error);
        if (isAdmin) {
          return NextResponse.json(
            { error: `Mail gönderilemedi: ${sent.error}` },
            { status: 502 },
          );
        }
        return ok;
      }
      return ok;
    }

    const staff = getStaffByEmail(email);
    if (staff) {
      const token = await createPasswordResetToken("staff", staff.id, staff.email);
      const resetUrl = passwordResetUrl(token, appOrigin);
      const sent = await sendPasswordResetEmail(
        { name: staff.name, email: staff.email },
        resetUrl,
      );
      if (!sent.ok) {
        console.error("Password reset email failed:", sent.error);
        if (isAdmin) {
          return NextResponse.json(
            { error: `Mail gönderilemedi: ${sent.error}` },
            { status: 502 },
          );
        }
      }
      return ok;
    }

    if (isAdmin) {
      return NextResponse.json(
        {
          error:
            "Bu e-posta için aktif öğrenci hesabı bulunamadı. Öğrenci önce davet linkinden şifre oluşturmalı.",
        },
        { status: 404 },
      );
    }
  } catch (error) {
    console.error("Password reset request failed:", error);
    if (isAdmin) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Şifre sıfırlama maili gönderilemedi.",
        },
        { status: 500 },
      );
    }
  }

  return ok;
}
