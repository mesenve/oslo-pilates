import { readStudioSnapshot, writeStudioSnapshot } from "@/app/api/studio/route";
import { DEFAULT_STAFF_PASSWORDS } from "@/lib/staff-auth";
import { hashPassword, verifyPassword } from "@/lib/server/staff-credentials";
import { getSessionUser } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "student") {
    return NextResponse.json({ error: "Bu işlem için eğitmen oturumu gerekli." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    currentPassword?: string; newPassword?: string; confirmPassword?: string;
  } | null;
  if (!body?.currentPassword || !body.newPassword || !body.confirmPassword) {
    return NextResponse.json({ error: "Tüm şifre alanları gerekli." }, { status: 400 });
  }
  if (body.newPassword.length < 6) {
    return NextResponse.json({ error: "Yeni şifre en az 6 karakter olmalı." }, { status: 400 });
  }
  if (body.newPassword !== body.confirmPassword) {
    return NextResponse.json({ error: "Yeni şifreler eşleşmiyor." }, { status: 400 });
  }
  const state = await readStudioSnapshot();
  const snapshot = (state.snapshot ?? {}) as { staffPasswords?: Record<string, string> };
  const current = snapshot.staffPasswords?.[user.id] ?? DEFAULT_STAFF_PASSWORDS[user.id] ?? "";
  if (!(await verifyPassword(body.currentPassword, current))) {
    return NextResponse.json({ error: "Mevcut şifre hatalı." }, { status: 401 });
  }
  if (await verifyPassword(body.newPassword, current)) {
    return NextResponse.json({ error: "Yeni şifre mevcut şifreden farklı olmalı." }, { status: 400 });
  }
  await writeStudioSnapshot({
    configured: true,
    snapshot: { ...snapshot, staffPasswords: { ...snapshot.staffPasswords, [user.id]: await hashPassword(body.newPassword) } },
  });
  return NextResponse.json({ ok: true });
}
