import { setInvitePassword } from "@/lib/server/invite-store";
import { verifyPasswordResetToken } from "@/lib/server/password-reset";
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

  const payload = verifyPasswordResetToken(token);
  if (!payload) {
    return NextResponse.json(
      { error: "Sıfırlama linki geçersiz veya süresi dolmuş. Yeni link iste." },
      { status: 400 },
    );
  }

  const updated = await setInvitePassword(payload.studentId, password);
  if (!updated) {
    return NextResponse.json(
      { error: "Hesap bulunamadı. Destek için stüdyoyla iletişime geç." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
