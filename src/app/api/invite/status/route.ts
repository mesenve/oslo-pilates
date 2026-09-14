import { getInviteByStudentId } from "@/lib/server/invite-store";
import { getSessionUser } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (user?.role !== "super_admin" && user?.role !== "instructor") {
    return NextResponse.json(
      { error: "Bu işlem için yönetici oturumu gerekli." },
      { status: 403 },
    );
  }

  const studentId = new URL(request.url).searchParams.get("studentId")?.trim();
  if (!studentId) {
    return NextResponse.json({ error: "Öğrenci bilgisi gerekli." }, { status: 400 });
  }

  const invite = await getInviteByStudentId(studentId);
  return NextResponse.json({
    exists: Boolean(invite),
    activated: Boolean(invite?.activatedAt && invite.password),
  });
}
