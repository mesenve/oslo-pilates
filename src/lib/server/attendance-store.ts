import {
  isSupabaseConfigured,
  listSupabaseAttendance,
  saveSupabaseAttendanceBatch,
} from "@/lib/server/supabase-rest";

export type AttendanceMarkStatus = "attend_pending" | "attended" | "upcoming";

export type StoredAttendanceMark = {
  sessionId: string;
  studentId: string;
  date: string;
  groupId: string;
  status: AttendanceMarkStatus;
  updatedAt: string;
};

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase yapılandırılmamış. Yoklama işlemleri için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.",
    );
  }
}

export async function saveAttendanceMarks(inputs: Array<{
  sessionId: string;
  studentId: string;
  date: string;
  groupId: string;
  status: AttendanceMarkStatus;
}>) {
  requireSupabase();
  const updatedAt = new Date().toISOString();
  const marks: StoredAttendanceMark[] = inputs.map((input) => ({ ...input, updatedAt }));
  await saveSupabaseAttendanceBatch(
    marks.map((mark) => ({
      session_id: mark.sessionId,
      student_id: mark.studentId,
      session_date: mark.date,
      group_id: mark.groupId,
      status: mark.status,
      updated_at: mark.updatedAt,
    })),
  );
  return marks;
}

export async function saveAttendanceMark(input: Parameters<typeof saveAttendanceMarks>[0][number]) {
  const [mark] = await saveAttendanceMarks([input]);
  return mark;
}

export async function listAttendanceMarks(filter?: {
  status?: AttendanceMarkStatus;
  studentId?: string;
}) {
  requireSupabase();
  const marks = (await listSupabaseAttendance()).map((mark) => ({
    sessionId: mark.session_id,
    studentId: mark.student_id,
    date: mark.session_date,
    groupId: mark.group_id,
    status: mark.status,
    updatedAt: mark.updated_at ?? new Date().toISOString(),
  }));
  return marks.filter(
    (mark) =>
      (!filter?.status || mark.status === filter.status) &&
      (!filter?.studentId || mark.studentId === filter.studentId),
  );
}
