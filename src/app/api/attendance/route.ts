import {
  type AttendanceMarkStatus,
  listAttendanceMarks,
  saveAttendanceMark,
} from "@/lib/server/attendance-store";
import { readStudioSnapshot } from "@/app/api/studio/route";
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

  const marks = await listAttendanceMarks({
    status: status && isAttendanceMarkStatus(status) ? status : undefined,
    studentId: user.role === "student" ? user.id : studentId || undefined,
  });

  return NextResponse.json({ marks });
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

  if (user.role === "student") {
    if (studentId !== user.id || status !== "attend_pending") {
      return NextResponse.json({ error: "Bu yoklama onayı için yetkiniz yok." }, { status: 403 });
    }
    const state = await readStudioSnapshot();
    const snapshot = state.snapshot as {
      sessions?: Array<{ id: string; studentId: string; status: string }>;
    } | null;
    const session = snapshot?.sessions?.find((item) => item.id === sessionId);
    if (
      !session ||
      session.studentId !== user.id ||
      session.status !== "upcoming" ||
      date !== todayISO()
    ) {
      return NextResponse.json({ error: "Bu ders için yoklama onayı verilemez." }, { status: 403 });
    }
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
