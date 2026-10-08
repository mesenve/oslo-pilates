import {
  findActivatedInviteByEmail,
  getInviteByStudentId,
} from "@/lib/server/invite-store";
import { readSupabaseStudioData } from "@/lib/server/supabase-rest";
import { sessionCookie } from "@/lib/server/session";
import { verifyPassword } from "@/lib/server/staff-credentials";
import { NextResponse } from "next/server";

type StudentLoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  let body: StudentLoginBody;

  try {
    body = (await request.json()) as StudentLoginBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
  }

  try {
    const data = await readSupabaseStudioData();
    // Prefer live students.email so admin email edits do not lock accounts out.
    let student = data.students.find((item) => item.email.trim().toLowerCase() === email);
    let invite = student ? await getInviteByStudentId(student.id) : null;

    // Legacy fallback: invite JSON email when students row was never synced.
    if ((!invite?.password || !invite.activatedAt) && !student) {
      invite = await findActivatedInviteByEmail(email);
      if (invite) {
        student = data.students.find((item) => item.id === invite!.student.id);
      }
    }

    if (student && (!invite?.password || !invite.activatedAt)) {
      return NextResponse.json(
        {
          error:
            "Hesabın henüz aktif değil. Davet e-postandaki linkten şifreni oluştur. Link elinde yoksa “Şifremi unuttum” ile yeni davet linki iste.",
        },
        { status: 401 },
      );
    }

    if (
      !student ||
      !invite?.password ||
      !invite.activatedAt ||
      !(await verifyPassword(password, invite.password))
    ) {
      return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
    }

    const response = NextResponse.json({
      student,
      sessions: data.sessions.filter((item) => item.studentId === student.id),
    });
    response.cookies.set(
      sessionCookie({
        id: student.id,
        name: student.name,
        email: student.email,
        role: "student",
      }),
    );
    return response;
  } catch (error) {
    console.error("Student login failed:", error);
    return NextResponse.json(
      { error: "Giriş servisi şu anda kullanılamıyor. Lütfen tekrar deneyin." },
      { status: 503 },
    );
  }
}
