import { listActivatedInvites } from "@/lib/server/invite-store";
import { NextResponse } from "next/server";

export async function GET() {
  const invites = await listActivatedInvites();

  return NextResponse.json({
    invites: invites.map((invite) => ({
      student: invite.student,
      sessions: invite.sessions,
    })),
  });
}
