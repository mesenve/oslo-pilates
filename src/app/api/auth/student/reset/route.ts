import { setInvitePassword } from "@/lib/server/invite-store";
import {
  resolveStaffPassword,
  setStaffPasswordHash,
} from "@/lib/server/staff-password-store";
import { hashPassword, verifyPassword } from "@/lib/server/staff-credentials";
import {
  consumePasswordResetToken,
  verifyPasswordResetToken,
} from "@/lib/server/password-reset";
import { validateStudentPassword } from "@/lib/student-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    password?: string;
    confirmPassword?: string;
  } | null;

  const token = body?.token?.trim() ?? "";
  const password = body?.password ?? "";
  const confirmPassword = body?.confirmPassword ?? "";

  const validationError = validateStudentPassword(password, confirmPassword);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const payload = await verifyPasswordResetToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Sıfırlama linki geçersiz veya süresi dolmuş. Yeni link iste." },
      { status: 400 },
    );
  }

  if (payload.kind === "staff") {
    const current = await resolveStaffPassword(payload.accountId);
    if (await verifyPassword(password, current)) {
      return NextResponse.json(
        { error: "Yeni şifre mevcut şifreden farklı olmalı." },
        { status: 400 },
      );
    }
    await setStaffPasswordHash(payload.accountId, await hashPassword(password));
    await consumePasswordResetToken(token);
    return NextResponse.json({ ok: true });
  }

  const updated = await setInvitePassword(payload.accountId, password);
  if (!updated) {
    return NextResponse.json(
      { error: "Hesap bulunamadı. Destek için stüdyoyla iletişime geç." },
      { status: 404 },
    );
  }

  await consumePasswordResetToken(token);
  return NextResponse.json({ ok: true });
}
