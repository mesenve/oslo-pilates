import {
  type AttendanceMarkStatus,
  listAttendanceMarks,
} from "@/lib/server/attendance-store";
import {
  readSupabaseStudioData,
  saveAttendanceBatchRpc,
  readSupabaseStudent,
} from "@/lib/server/supabase-rest";
import { canManageStudent } from "@/lib/access";
import { todayISO } from "@/lib/dates";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

function isAttendanceMarkStatus(value: string): value is AttendanceMarkStatus {
  return value === "attend_pending" || value === "attended" || value === "upcoming";
}

type AttendanceBody = {
  sessionId?: string;
  studentId?: string;
  date?: string;
  groupId?: string;
  status?: string;
  marks?: Array<{
    sessionId?: string;
    studentId?: string;
    date?: string;
    groupId?: string;
    status?: string;
  }>;
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim();
  const studentId = url.searchParams.get("studentId")?.trim();

  if (status && !isAttendanceMarkStatus(status)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  if (user.role === "student" && studentId && studentId !== user.id) {
    return NextResponse.json({ error: "Bu veriye erişim yok." }, { status: 403 });
  }

  if (user.role === "instructor" && studentId) {
    const data = await readSupabaseStudioData();
    if (!canManageStudent(user, studentId, data.students)) {
      return NextResponse.json({ error: "Bu öğrenci için yoklama yetkin yok." }, { status: 403 });
    }
  }

  const marks = await listAttendanceMarks({
    status: status && isAttendanceMarkStatus(status) ? status : undefined,
    studentId: user.role === "student" ? user.id : studentId || undefined,
  });

  const staffData = user.role === "instructor" && !studentId
    ? await readSupabaseStudioData()
    : null;

  const visibleMarks = user.role === "instructor" && !studentId
    ? marks.filter((mark) => {
        return canManageStudent(user, mark.studentId, staffData?.students ?? []);
      })
    : marks;

  return NextResponse.json({ marks: visibleMarks });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Bu işlem için eğitmen oturumu gerekli." }, { status: 403 });
  }
  let body: AttendanceBody;

  try {
    body = (await request.json()) as AttendanceBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const rawMarks = body.marks?.length
    ? body.marks
    : [body];
  const inputMarks = rawMarks.map((mark) => ({
    sessionId: mark.sessionId?.trim(),
    studentId: mark.studentId?.trim(),
    date: mark.date?.trim(),
    groupId: mark.groupId?.trim(),
    status: mark.status?.trim(),
  }));
  if (inputMarks.some((mark) => !mark.sessionId || !mark.studentId || !mark.date || !mark.groupId || !mark.status)) {
    return NextResponse.json({ error: "Oturum bilgileri eksik." }, { status: 400 });
  }
  if (inputMarks.some((mark) => !isAttendanceMarkStatus(mark.status!))) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const data = await readSupabaseStudioData() as {
    students?: Array<{ id: string; instructorId: string }>;
    sessions?: Array<{ id: string; studentId: string; date: string; groupId: string; status: string }>;
  } | null;
  const sessions = inputMarks.map((mark) => data?.sessions?.find((item) => item.id === mark.sessionId));
  const sessionStudents = sessions.map((session) =>
    data?.students?.find((item) => item.id === session?.studentId),
  );
  const sharedPair = ["staff-delfin", "staff-elif"];
  const managed = sessions.every((session, index) => {
    const sessionStudent = sessionStudents[index];
    return Boolean(
      session &&
        sessionStudent &&
        (user.role === "super_admin" ||
          sessionStudent.instructorId === user.id ||
          (sharedPair.includes(sessionStudent.instructorId) &&
            sharedPair.includes(user.id))),
    );
  });
  if (user.role === "student") {
    const validStudentMarks = inputMarks.every((mark, index) => {
      const session = sessions[index];
      return mark.studentId === user.id && mark.status === "attend_pending" &&
        Boolean(session && session.studentId === user.id && session.status === "upcoming" && mark.date === todayISO());
    });
    if (!validStudentMarks) {
      return NextResponse.json({ error: "Bu ders için yoklama onayı verilemez." }, { status: 403 });
    }
  } else if (!managed) {
    return NextResponse.json({ error: "Bu öğrenci için yoklama yetkin yok." }, { status: 403 });
  }
  const canonicalMarks = inputMarks.map((mark, index) => ({
    sessionId: sessions[index]?.id ?? mark.sessionId!,
    studentId: sessions[index]?.studentId ?? mark.studentId!,
    date: sessions[index]?.date ?? mark.date!,
    groupId: sessions[index]?.groupId ?? mark.groupId!,
    status: mark.status as AttendanceMarkStatus,
  }));

  try {
    await saveAttendanceBatchRpc(canonicalMarks.map((mark) => ({
      session_id: mark.sessionId, student_id: mark.studentId,
      session_date: mark.date, group_id: mark.groupId, status: mark.status,
    })), user);
    const marks = await listAttendanceMarks();
    const ids = new Set(canonicalMarks.map((mark) => mark.sessionId));
    const students = await Promise.all(
      [...new Set(canonicalMarks.map((mark) => mark.studentId))].map(readSupabaseStudent),
    );
    return NextResponse.json({ ok: true, marks: marks.filter((mark) => ids.has(mark.sessionId)), students });
  } catch (error) {
    console.error("Attendance save failed:", error);
    return NextResponse.json(
      { error: "Yoklama kaydedilemedi." },
      { status: 500 },
    );
  }
}
