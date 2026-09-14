import { activateInvite, getInviteByToken } from "@/lib/server/invite-store";
import { validateStudentPassword } from "@/lib/student-auth";
import { isInviteValid } from "@/lib/student-auth";
import { sessionCookie } from "@/lib/server/session";
import { NextResponse } from "next/server";

type ActivateBody = {
  token?: string;
  password?: string;
  confirmPassword?: string;
};

export async function POST(request: Request) {
  let body: ActivateBody;

  try {
    body = (await request.json()) as ActivateBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const token = body.token?.trim();
  const password = body.password ?? "";
  const confirmPassword = body.confirmPassword ?? "";

  if (!token) {
    return NextResponse.json({ error: "Davet linki geçersiz." }, { status: 400 });
  }

  const validationError = validateStudentPassword(password, confirmPassword);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const invite = await getInviteByToken(token);
  if (!invite) {
    return NextResponse.json({ error: "Davet linki geçersiz." }, { status: 404 });
  }

  if (invite.activatedAt) {
    return NextResponse.json({ error: "Hesap zaten aktif." }, { status: 409 });
  }

  if (!isInviteValid(invite.student)) {
    return NextResponse.json({ error: "Davet süresi dolmuş." }, { status: 410 });
  }

  const activated = await activateInvite(token, password);
  if (!activated) {
    return NextResponse.json({ error: "Davet linki geçersiz." }, { status: 404 });
  }

  const response = NextResponse.json({
    student: activated.student,
    sessions: activated.sessions,
  });
  response.cookies.set(sessionCookie({
    id: activated.student.id,
    name: activated.student.name,
    email: activated.student.email,
    role: "student",
  }));
  return response;
}
