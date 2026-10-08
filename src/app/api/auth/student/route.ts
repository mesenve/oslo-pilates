import { getStudentAccount, readSupabaseStudentSessions, recordLoginEvent } from "@/lib/server/supabase-rest";
import { sessionCookie } from "@/lib/server/session";
import { verifyPassword } from "@/lib/server/staff-credentials";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password || email.length > 254 || password.length > 1024) {
    return NextResponse.json({ error: "Geçerli e-posta ve şifre gerekli." }, { status: 400 });
  }
  try {
    const account = await getStudentAccount({ email });
    const audit = (outcome: string) => recordLoginEvent({
      account_id: account?.student.id, email, role: "student", outcome,
    });
    if (account && !account.archived && account.student.accountStatus === "invited" &&
        !account.invite?.password) {
      const expiry = account.student.inviteExpiresAt;
      const expired = !expiry || new Date(expiry).getTime() <= Date.now();
      await audit(expired ? "expired_invite" : "inactive");
      return NextResponse.json({ error: expired
        ? "Davet bağlantınızın süresi dolmuş. Öğretmeninizden yeni davet isteyin."
        : "Hesabınızı tamamlamak için e-postanızdaki davet bağlantısından şifrenizi oluşturun.",
      }, { status: 403 });
    }
    if (!account || account.archived || account.student.accountStatus !== "active" ||
        !account.invite?.activated_at || !account.invite.password ||
        !(await verifyPassword(password, account.invite.password))) {
      await audit("invalid_credentials");
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }
    const sessions = await readSupabaseStudentSessions(account.student.id);
    const response = NextResponse.json({
      student: account.student,
      sessions: sessions.filter((item) =>
        item.date >= account.student.package.startDate &&
        item.date <= account.student.package.endDate),
    });
    response.cookies.set(await sessionCookie({
      id: account.student.id, name: account.student.name,
      email: account.student.email, role: "student",
    }, body.rememberMe !== false, account.invite.password));
    await audit("success");
    return response;
  } catch {
    console.error("Student authentication storage is unavailable");
    return NextResponse.json({
      error: "Giriş servisine şu anda ulaşılamıyor. Lütfen tekrar deneyin.",
    }, { status: 503 });
  }
}
