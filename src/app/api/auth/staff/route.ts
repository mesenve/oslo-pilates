import { getStaffByEmail } from "@/data/staff";
import { resolveStaffPassword } from "@/lib/server/staff-password-store";
import { verifyPassword } from "@/lib/server/staff-credentials";
import { sessionCookie } from "@/lib/server/session";
import { recordLoginEvent } from "@/lib/server/supabase-rest";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 1024) {
    return NextResponse.json({ error: "Geçerli e-posta ve şifre gerekli." }, { status: 400 });
  }
  try {
    const staff = getStaffByEmail(email);
    const stored = staff ? await resolveStaffPassword(staff.id) : "";
    if (!staff || !stored || !(await verifyPassword(password, stored))) {
      await recordLoginEvent({ account_id: staff?.id, email, role: "staff", outcome: "invalid_credentials" });
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }
    const response = NextResponse.json({ user: staff });
    response.cookies.set(await sessionCookie(staff, body.rememberMe !== false, stored));
    await recordLoginEvent({ account_id: staff.id, email, role: staff.role, outcome: "success" });
    return response;
  } catch {
    console.error("Staff authentication storage is unavailable");
    return NextResponse.json({
      error: "Giriş servisine şu anda ulaşılamıyor. Lütfen tekrar deneyin.",
    }, { status: 503 });
  }
}
