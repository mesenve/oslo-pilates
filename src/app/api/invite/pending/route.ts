import { readStudioSnapshot, writeStudioSnapshot } from "@/app/api/studio/route";
import { sendWelcomeInviteEmail } from "@/lib/email";
import { saveInvite } from "@/lib/server/invite-store";
import { createInviteToken, inviteExpiresAt, inviteUrl } from "@/lib/student-auth";
import { getSessionUser } from "@/lib/server/session";
import type { Session, Student } from "@/types/studio";
import { NextResponse } from "next/server";

type StudioSnapshot = { students?: Student[]; sessions?: Session[] };

function pendingStudents(snapshot: StudioSnapshot) {
  return (snapshot.students ?? []).filter(
    (student) => student.accountStatus === "invited" && student.email.trim(),
  );
}

export async function GET() {
  const user = await getSessionUser();
  if (user?.role !== "super_admin") {
    return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekli." }, { status: 403 });
  }
  const state = await readStudioSnapshot();
  return NextResponse.json({ count: pendingStudents((state.snapshot ?? {}) as StudioSnapshot).length });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "super_admin") {
    return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekli." }, { status: 403 });
  }

  const state = await readStudioSnapshot();
  const snapshot = (state.snapshot ?? {}) as StudioSnapshot;
  const recipients = pendingStudents(snapshot);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const sessions = snapshot.sessions ?? [];
  const refreshedStudents = new Map<string, Student>();
  let sent = 0;
  let failed = 0;

  for (const student of recipients) {
    const token = createInviteToken();
    const expiresAt = inviteExpiresAt();
    const refreshedStudent: Student = {
      ...student,
      accountStatus: "invited",
      inviteToken: token,
      inviteExpiresAt: expiresAt,
      invitedAt: new Date().toISOString(),
    };
    refreshedStudents.set(student.id, refreshedStudent);

    try {
      await saveInvite({
        token,
        student: refreshedStudent,
        sessions: sessions.filter((session) => session.studentId === student.id),
        expiresAt,
      });
      const result = await sendWelcomeInviteEmail(
        refreshedStudent,
        inviteUrl(token, origin),
      );
      if (result.ok) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  if (refreshedStudents.size) {
    await writeStudioSnapshot({
      configured: true,
      snapshot: {
        ...snapshot,
        students: (snapshot.students ?? []).map(
          (student) => refreshedStudents.get(student.id) ?? student,
        ),
      },
    });
  }

  return NextResponse.json({ total: recipients.length, sent, failed });
}
