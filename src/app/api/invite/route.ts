import { sendWelcomeInviteEmail } from "@/lib/email";
import {
  getInviteByToken,
  inviteTokenFromUrl,
  saveInvite,
} from "@/lib/server/invite-store";
import { isInviteValid } from "@/lib/student-auth";
import type { Session, Student } from "@/types/studio";
import { NextResponse } from "next/server";

type InviteRequestBody = {
  name?: string;
  email?: string;
  inviteUrl?: string;
  student?: Student;
  sessions?: Session[];
  expiresAt?: string;
};

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Token gerekli." }, { status: 400 });
  }

  const invite = await getInviteByToken(token);
  if (!invite) {
    return NextResponse.json({ found: false }, { status: 404 });
  }

  const expired = !isInviteValid(invite.student);
  const active = Boolean(invite.activatedAt);

  return NextResponse.json({
    found: true,
    expired,
    active,
    student: {
      name: invite.student.name,
      email: invite.student.email,
      accountStatus: invite.student.accountStatus,
    },
  });
}

export async function POST(request: Request) {
  let body: InviteRequestBody;

  try {
    body = (await request.json()) as InviteRequestBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const inviteUrl = body.inviteUrl?.trim();
  const student = body.student;
  const sessions = body.sessions;
  const expiresAt = body.expiresAt?.trim();

  if (!name || !email || !inviteUrl) {
    return NextResponse.json(
      { error: "Ad, e-posta ve davet linki gerekli." },
      { status: 400 },
    );
  }

  if (!/^https?:\/\//.test(inviteUrl)) {
    return NextResponse.json({ error: "Davet linki geçersiz." }, { status: 400 });
  }

  const token = inviteTokenFromUrl(inviteUrl);
  if (!token) {
    return NextResponse.json({ error: "Davet linki geçersiz." }, { status: 400 });
  }

  if (!student || !sessions?.length || !expiresAt) {
    return NextResponse.json(
      { error: "Davet kaydı eksik. Lütfen daveti yeniden gönder." },
      { status: 400 },
    );
  }

  try {
    await saveInvite({
      token,
      student,
      sessions,
      expiresAt,
    });
  } catch (error) {
    console.error("Invite store save failed:", error);
    return NextResponse.json(
      { error: "Davet kaydedilemedi. Lütfen tekrar dene." },
      { status: 500 },
    );
  }

  let result: Awaited<ReturnType<typeof sendWelcomeInviteEmail>>;
  try {
    result = await sendWelcomeInviteEmail({ name, email }, inviteUrl);
  } catch (error) {
    console.error("Invite email send failed:", error);
    return NextResponse.json(
      { error: "Davet maili gönderilemedi. Lütfen tekrar dene." },
      { status: 502 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
