import { findActivatedInviteByEmail } from "@/lib/server/invite-store";
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

  const email = body.email?.trim();
  const password = body.password ?? "";

  if (!email || !password) {
    return NextResponse.json({ error: "E-posta ve şifre gerekli." }, { status: 400 });
  }

  const invite = await findActivatedInviteByEmail(email);
  if (!invite?.password || !(await verifyPassword(password, invite.password))) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }

  const data = await readSupabaseStudioData();
  const student = data.students.find((item) => item.id === invite.student.id);
  if (!student) {
    return NextResponse.json({ error: "Öğrenci kaydı bulunamadı." }, { status: 404 });
  }

  const response = NextResponse.json({
    student,
    sessions: data.sessions.filter((item) => item.studentId === student.id),
  });
  response.cookies.set(sessionCookie({
    id: student.id,
    name: student.name,
    email: student.email,
    role: "student",
  }));
  return response;
}
