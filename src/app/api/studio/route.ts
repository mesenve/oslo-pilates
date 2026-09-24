import {
  isSupabaseConfigured,
  readSupabaseStudioData,
} from "@/lib/server/supabase-rest";
import { getSessionUser } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function readStudioData() {
  if (!isSupabaseConfigured()) return null;
  return readSupabaseStudioData();
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }
  const data = await readStudioData();
  if (!data) {
    return NextResponse.json({ configured: false, data: null });
  }

  const visibleStudentIds = new Set(
    user.role === "super_admin"
      ? data.students.map((student) => student.id)
      : user.role === "student"
        ? [user.id]
        : data.students
            .filter(
              (student) =>
                student.instructorId === user.id ||
                (["staff-delfin", "staff-elif"].includes(student.instructorId) &&
                  ["staff-delfin", "staff-elif"].includes(user.id)),
            )
            .map((student) => student.id),
  );

  return NextResponse.json({
    configured: true,
    data: {
      students: data.students.filter((student) =>
        visibleStudentIds.has(student.id),
      ),
      archivedStudents:
        user.role === "super_admin"
          ? data.archivedStudents
          : data.archivedStudents.filter((student) =>
              visibleStudentIds.has(student.id),
            ),
      sessions: data.sessions.filter((session) =>
        visibleStudentIds.has(session.studentId),
      ),
      postponeRequests: data.postponeRequests.filter((postpone) =>
        visibleStudentIds.has(postpone.studentId),
      ),
      customGroups: data.customGroups,
      blockedEmails: user.role === "super_admin" ? data.blockedEmails : [],
    },
  });
}
