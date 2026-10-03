import { listActivatedInvites } from "@/lib/server/invite-store";
import { readSupabaseStudioData } from "@/lib/server/supabase-rest";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

export async function GET() {
  const user = await getSessionUser();
  if (user?.role !== "super_admin") {
    return NextResponse.json({ error: "Bu işlem için yönetici oturumu gerekli." }, { status: 403 });
  }
  const invites = await listActivatedInvites();
  const data = await readSupabaseStudioData();
  const studentsById = new Map(
    [...data.students, ...data.archivedStudents].map((student) => [student.id, student]),
  );

  return NextResponse.json({
    // Invite rows only identify activated accounts. The student and session
    // payload always comes from the canonical Supabase tables.
    invites: invites.flatMap((invite) => {
      const student = studentsById.get(invite.student.id);
      if (!student) return [];
      return [{
        student,
        sessions: data.sessions.filter((session) => session.studentId === student.id),
      }];
    }),
  });
}
