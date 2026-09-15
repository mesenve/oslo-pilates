import { findActivatedInviteByEmail } from "@/lib/server/invite-store";
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

  const response = NextResponse.json({
    student: invite.student,
    sessions: invite.sessions,
  });
  response.cookies.set(sessionCookie({
    id: invite.student.id,
    name: invite.student.name,
    email: invite.student.email,
    role: "student",
  }));
  return response;
}
