import {
  type AttendanceMarkStatus,
  listAttendanceMarks,
  saveAttendanceMark,
} from "@/lib/server/attendance-store";
import { NextResponse } from "next/server";

function isAttendanceMarkStatus(value: string): value is AttendanceMarkStatus {
  return value === "attend_pending" || value === "attended" || value === "upcoming";
}

type AttendanceBody = {
  sessionId?: string;
  studentId?: string;
  date?: string;
  groupId?: string;
  status?: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim();
  const studentId = url.searchParams.get("studentId")?.trim();

  if (status && !isAttendanceMarkStatus(status)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  const marks = await listAttendanceMarks({
    status: status && isAttendanceMarkStatus(status) ? status : undefined,
    studentId: studentId || undefined,
  });

  return NextResponse.json({ marks });
}

export async function POST(request: Request) {
  let body: AttendanceBody;

  try {
    body = (await request.json()) as AttendanceBody;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const sessionId = body.sessionId?.trim();
  const studentId = body.studentId?.trim();
  const date = body.date?.trim();
  const groupId = body.groupId?.trim();
  const status = body.status?.trim();

  if (!sessionId || !studentId || !date || !groupId || !status) {
    return NextResponse.json(
      { error: "Oturum bilgileri eksik." },
      { status: 400 },
    );
  }

  if (!isAttendanceMarkStatus(status)) {
    return NextResponse.json({ error: "Geçersiz durum." }, { status: 400 });
  }

  try {
    const mark = await saveAttendanceMark({
      sessionId,
      studentId,
      date,
      groupId,
      status,
    });
    return NextResponse.json({ ok: true, mark });
  } catch (error) {
    console.error("Attendance save failed:", error);
    return NextResponse.json(
      { error: "Yoklama kaydedilemedi." },
      { status: 500 },
    );
  }
}
