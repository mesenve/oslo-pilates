import { findActivatedInviteByEmail } from "@/lib/server/invite-store";
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
  if (!invite?.password || invite.password !== password) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }

  return NextResponse.json({
    student: invite.student,
    sessions: invite.sessions,
    password: invite.password,
  });
}
