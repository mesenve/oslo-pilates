import { canManageStudent } from "@/lib/access";
import {
  deleteSupabaseStudent,
  patchSupabaseStudent,
  patchSupabaseStudentPackage,
  readSupabaseStudioData,
  saveSupabaseStudentBundle,
} from "@/lib/server/supabase-rest";
import { getSessionUser } from "@/lib/server/session";
import type { ClassGroup, Session, Student } from "@/types/studio";
import { NextResponse } from "next/server";

type SaveBody = {
  action?: "save";
  mode?: "create" | "update" | "restore";
  student?: Student;
  sessions?: Session[];
  customGroup?: ClassGroup;
};

type PatchBody =
  | { action?: "archive"; studentId?: string }
  | {
      action?: "postpone-used";
      studentId?: string;
      used?: boolean;
      usedAt?: string;
    }
  | {
      action?: "invite";
      studentId?: string;
      inviteToken?: string;
      inviteExpiresAt?: string;
      invitedAt?: string;
    };

function isStaff(user: Awaited<ReturnType<typeof getSessionUser>>) {
  return user?.role === "super_admin" || user?.role === "instructor";
}

function findStudent(
  id: string,
  active: Student[],
  archived: Student[],
) {
  return [...active, ...archived].find((student) => student.id === id);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!isStaff(user)) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as SaveBody | null;
  if (
    body?.action !== "save" ||
    !body.student ||
    !body.mode ||
    !Array.isArray(body.sessions)
  ) {
    return NextResponse.json({ error: "Öğrenci verisi eksik." }, { status: 400 });
  }

  const data = await readSupabaseStudioData();
  const existing = findStudent(body.student.id, data.students, data.archivedStudents);
  if (body.mode !== "create" && !existing) {
    return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
  }
  if (body.mode === "create" && existing) {
    return NextResponse.json({ error: "Öğrenci zaten mevcut." }, { status: 409 });
  }
  if (user!.role === "instructor") {
    if (
      (existing &&
        !canManageStudent(user!, existing.id, [
          ...data.students,
          ...data.archivedStudents,
        ])) ||
      (!existing && body.student.instructorId !== user!.id) ||
      (existing && body.student.instructorId !== existing.instructorId)
    ) {
      return NextResponse.json({ error: "Bu öğrenci için yetkiniz yok." }, { status: 403 });
    }
  }

  const email = body.student.email.trim().toLowerCase();
  const emailTaken = [...data.students, ...data.archivedStudents].some(
    (student) =>
      student.id !== body.student!.id &&
      student.email.trim().toLowerCase() === email,
  );
  if (!email || emailTaken) {
    return NextResponse.json(
      { error: emailTaken ? "Bu e-posta ile kayıtlı öğrenci var." : "E-posta gerekli." },
      { status: emailTaken ? 409 : 400 },
    );
  }
  if (body.sessions.some((session) => session.studentId !== body.student!.id)) {
    return NextResponse.json({ error: "Ders verisi öğrenciyle eşleşmiyor." }, { status: 400 });
  }

  const periodChanged = Boolean(
    existing &&
      (existing.package.startDate !== body.student.package.startDate ||
        existing.package.totalSessions !== body.student.package.totalSessions),
  );
  const studentToSave: Student = {
    ...body.student,
    email,
    renewalRequest: existing
      ? existing.renewalRequest
      : body.student.renewalRequest,
    postponeLessonUsed:
      existing && !periodChanged
        ? existing.postponeLessonUsed
        : body.student.postponeLessonUsed,
    postponeLessonUsedAt:
      existing && !periodChanged
        ? existing.postponeLessonUsedAt
        : body.student.postponeLessonUsedAt,
    postponeLessonNote: undefined,
    accountStatus:
      existing && existing.email.trim().toLowerCase() === email
        ? existing.accountStatus
        : body.student.accountStatus,
    inviteToken:
      existing && existing.email.trim().toLowerCase() === email
        ? existing.inviteToken
        : body.student.inviteToken,
    inviteExpiresAt:
      existing && existing.email.trim().toLowerCase() === email
        ? existing.inviteExpiresAt
        : body.student.inviteExpiresAt,
    invitedAt:
      existing && existing.email.trim().toLowerCase() === email
        ? existing.invitedAt
        : body.student.invitedAt,
  };
  await saveSupabaseStudentBundle({
    student: studentToSave,
    sessions: body.sessions,
    customGroup: body.customGroup,
    clearPostpones: body.mode === "restore",
  });
  return NextResponse.json({ ok: true, student: studentToSave });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!isStaff(user)) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const studentId = body?.studentId?.trim();
  if (!body?.action || !studentId) {
    return NextResponse.json({ error: "İşlem ve öğrenci gerekli." }, { status: 400 });
  }

  const data = await readSupabaseStudioData();
  const student = findStudent(studentId, data.students, data.archivedStudents);
  if (
    !student ||
    (user!.role === "instructor" &&
      !canManageStudent(user!, studentId, [...data.students, ...data.archivedStudents]))
  ) {
    return NextResponse.json({ error: "Bu öğrenci için yetkiniz yok." }, { status: 403 });
  }

  if (body.action === "archive") {
    await patchSupabaseStudent(studentId, { archived_at: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "postpone-used") {
    await patchSupabaseStudentPackage(studentId, {
      postponeLessonUsed: Boolean(body.used),
      postponeLessonUsedAt: body.used ? body.usedAt || new Date().toISOString().slice(0, 10) : null,
      postponeLessonNote: null,
    });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "invite") {
    if (!body.inviteToken || !body.inviteExpiresAt || !body.invitedAt) {
      return NextResponse.json({ error: "Davet bilgileri eksik." }, { status: 400 });
    }
    await patchSupabaseStudent(studentId, {
      account_status: "invited",
      invite_token: body.inviteToken,
      invite_expires_at: body.inviteExpiresAt,
      invited_at: body.invitedAt,
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!isStaff(user)) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { studentId?: string } | null;
  const studentId = body?.studentId?.trim();
  if (!studentId) {
    return NextResponse.json({ error: "Öğrenci kimliği gerekli." }, { status: 400 });
  }

  const data = await readSupabaseStudioData();
  const student = findStudent(studentId, data.students, data.archivedStudents);
  if (
    !student ||
    (user!.role === "instructor" &&
      !canManageStudent(user!, studentId, [...data.students, ...data.archivedStudents]))
  ) {
    return NextResponse.json({ error: "Bu öğrenci için yetkiniz yok." }, { status: 403 });
  }
  await deleteSupabaseStudent(studentId);
  return NextResponse.json({ ok: true });
}
