import { listActivatedInvites } from "@/lib/server/invite-store";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

export async function GET() {
  const user = await getSessionUser();
  if (user?.role !== "super_admin") {
    return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekli." }, { status: 403 });
  }
  const invites = await listActivatedInvites();

  return NextResponse.json({
    invites: invites.map((invite) => ({
      student: invite.student,
      sessions: invite.sessions,
    })),
  });
}
