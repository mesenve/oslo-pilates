import { sendPasswordResetEmail, sendWelcomeInviteEmail } from "@/lib/email";
import { getStaffByEmail } from "@/data/staff";
import {
  findActivatedInviteByEmail,
  getInviteByStudentId,
  saveInvite,
} from "@/lib/server/invite-store";
import { createInviteToken, inviteExpiresAt, inviteUrl } from "@/lib/student-auth";
import { patchSupabaseStudent, readSupabaseStudioData } from "@/lib/server/supabase-rest";
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
      "Talep alındı. E-posta kayıtlıysa kısa süre içinde şifre veya davet bağlantısı gelir. Gelen kutunu ve spam klasörünü kontrol et.",
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

    const normalized = email.toLowerCase();
    const studio = await readSupabaseStudioData();
    const liveStudent = studio.students.find(
      (item) => item.email.trim().toLowerCase() === normalized,
    );
    const invite = liveStudent
      ? await getInviteByStudentId(liveStudent.id)
      : await findActivatedInviteByEmail(email);
    const account = liveStudent ?? invite?.student;
    if (invite?.password && invite.activatedAt && account) {
      const token = await createPasswordResetToken(
        "student",
        account.id,
        account.email,
      );
      const resetUrl = passwordResetUrl(token, appOrigin);
      const sent = await sendPasswordResetEmail(
        { name: account.name, email: account.email },
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

    // Never activated (or invite lost/expired): a reset link is useless, send a fresh invite.
    if (liveStudent) {
      const token = createInviteToken();
      const expiresAt = inviteExpiresAt();
      const invitedAt = new Date().toISOString();
      await saveInvite({
        token,
        student: {
          ...liveStudent,
          accountStatus: "invited",
          inviteToken: token,
          inviteExpiresAt: expiresAt,
          invitedAt,
        },
        sessions: studio.sessions.filter((item) => item.studentId === liveStudent.id),
        expiresAt,
      });
      await patchSupabaseStudent(liveStudent.id, {
        account_status: "invited",
        invite_token: token,
        invite_expires_at: expiresAt,
        invited_at: invitedAt,
      });
      const sent = await sendWelcomeInviteEmail(
        { name: liveStudent.name, email: liveStudent.email },
        inviteUrl(token, appOrigin),
      );
      if (!sent.ok) {
        console.error("Invite resend email failed:", sent.error);
        if (isAdmin) {
          return NextResponse.json({ error: `Mail gönderilemedi: ${sent.error}` }, { status: 502 });
        }
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
