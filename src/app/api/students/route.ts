import { canManageStudent } from "@/lib/access";
import { getClassGroupById, isPresetGroupId } from "@/data/groups";
import {
  deleteSupabaseStudent,
  patchSupabaseStudent,
  patchSupabaseStudentPackage,
  readSupabaseStudioData,
  saveSupabaseStudentBundle,
} from "@/lib/server/supabase-rest";
import { syncInviteStudentProfile } from "@/lib/server/invite-store";
import { getSessionUser } from "@/lib/server/session";
import type { ClassGroup, DayOfWeek, Session, Student } from "@/types/studio";
import { NextResponse } from "next/server";
import { packagePeriodKey } from "@/lib/package-period";

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
      action?: "postpone-note";
      studentId?: string;
      note?: string;
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

const DAY_BY_UTC_INDEX: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function sameDays(left: DayOfWeek[], right: DayOfWeek[]) {
  return left.length === right.length && left.every((day) => right.includes(day));
}

function validateStudentSchedule(
  student: Student,
  sessions: Session[],
  customGroup: ClassGroup | undefined,
  customGroups: ClassGroup[],
) {
  const selectedGroup = isPresetGroupId(student.groupId)
    ? getClassGroupById(student.groupId)
    : customGroups.find((group) => group.id === student.groupId);
  const customDays = student.package.customSchedule?.days ?? [];

  // A selected saved group is authoritative. A different custom schedule here
  // is the exact stale-data combination that used to add unintended weekdays.
  if (selectedGroup && customDays.length && !sameDays(customDays, selectedGroup.days)) {
    return "Seçilen grup ile özel program günleri uyuşmuyor.";
  }
  if (customGroup && customGroup.id !== student.groupId) {
    return "Özel grup öğrenci programıyla eşleşmiyor.";
  }
  if (customGroup && customDays.length && !sameDays(customDays, customGroup.days)) {
    return "Özel program günleri grupla uyuşmuyor.";
  }

  const days = customGroup?.days ?? (customDays.length ? customDays : selectedGroup?.days ?? []);
  if (!days.length) return "Ders günleri tanımlı değil.";
  if (sessions.length !== student.package.totalSessions) {
    return "Seans sayısı paket bilgisiyle eşleşmiyor.";
  }
  const uniqueDates = new Set<string>();
  const packageStart = student.package.startDate;
  const packageEnd = student.package.endDate;
  for (const session of sessions) {
    if (session.groupId !== student.groupId) return "Ders grubu öğrenci programıyla eşleşmiyor.";
    if (uniqueDates.has(session.date)) return "Aynı tarih için birden fazla seans var.";
    uniqueDates.add(session.date);
    if (packageStart && session.date < packageStart) {
      return "Seans tarihi paket başlangıcından önce olamaz.";
    }
    if (packageEnd && session.date > packageEnd) {
      return "Seans tarihi paket bitişinden sonra olamaz.";
    }
    const date = new Date(`${session.date}T00:00:00Z`);
    const day = DAY_BY_UTC_INDEX[date.getUTCDay()];
    if (!day || !days.includes(day)) {
      return "Seans günleri seçilen programla eşleşmiyor.";
    }
  }
  return null;
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
  if (
    body.mode !== "create" &&
    existing?.updatedAt &&
    body.student.updatedAt !== existing.updatedAt
  ) {
    return NextResponse.json(
      { error: "Bu öğrenci başka bir ekranda güncellendi. Sayfayı yenileyip tekrar deneyin." },
      { status: 409 },
    );
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
  const scheduleError = validateStudentSchedule(
    body.student,
    body.sessions,
    body.customGroup,
    data.customGroups,
  );
  if (scheduleError) {
    return NextResponse.json({ error: scheduleError }, { status: 400 });
  }

  const periodChanged = Boolean(
    existing &&
      packagePeriodKey(existing) !== packagePeriodKey(body.student),
  );
  // remainingSessions is denormalized package metadata. For an existing
  // package edit, derive it from the submitted canonical session statuses so
  // stale client data cannot overwrite the real progress.
  const canonicalRemaining = Math.max(
    0,
    body.student.package.totalSessions -
      body.sessions.filter(
        (session) =>
          (session.status === "attended" || session.status === "missed") &&
          session.date >= body.student!.package.startDate &&
          session.date <= body.student!.package.endDate,
      ).length,
  );
  const studentToSave: Student = {
    ...body.student,
    package: {
      ...body.student.package,
      remainingSessions:
        existing && !periodChanged
          ? canonicalRemaining
          : body.student.package.remainingSessions,
    },
    email,
    // A real package-period change clears any sticky pending renewal request.
    renewalRequest: existing
      ? periodChanged
        ? undefined
        : existing.renewalRequest
      : body.student.renewalRequest,
    postponeLessonUsed:
      existing && !periodChanged
        ? existing.postponeLessonUsed
        : body.student.postponeLessonUsed,
    postponeLessonUsedAt:
      existing && !periodChanged
        ? existing.postponeLessonUsedAt
        : body.student.postponeLessonUsedAt,
    postponeLessonNote:
      existing && !periodChanged
        ? existing.postponeLessonNote
        : body.student.postponeLessonNote,
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
  try {
    await saveSupabaseStudentBundle({
      student: studentToSave,
      sessions: body.sessions,
      customGroup: body.customGroup,
      clearPostpones: body.mode === "restore",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("student changed")) {
      return NextResponse.json(
        { error: "Bu öğrenci başka bir ekranda güncellendi. Sayfayı yenileyip tekrar deneyin." },
        { status: 409 },
      );
    }
    throw error;
  }
  // Return the database version so a second edit in the same tab carries the
  // current optimistic-lock token instead of the pre-save timestamp.
  const refreshed = await readSupabaseStudioData();
  const persistedStudent = findStudent(body.student.id, refreshed.students, refreshed.archivedStudents);
  const forInvite = persistedStudent ?? studentToSave;
  try {
    await syncInviteStudentProfile(forInvite);
  } catch (error) {
    console.error("Invite profile sync failed:", error);
  }
  return NextResponse.json({ ok: true, student: forInvite });
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
    });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "postpone-note") {
    await patchSupabaseStudentPackage(studentId, {
      postponeLessonNote: typeof body.note === "string" ? body.note.trim() : "",
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
  // Permanent deletion is intentionally restricted to the archive/admin
  // workflow. Instructors can archive records, but cannot remove attendance,
  // invite and session history irreversibly.
  if (user?.role !== "super_admin") {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { studentId?: string } | null;
  const studentId = body?.studentId?.trim();
  if (!studentId) {
    return NextResponse.json({ error: "Öğrenci kimliği gerekli." }, { status: 400 });
  }

  const data = await readSupabaseStudioData();
  const student = findStudent(studentId, data.students, data.archivedStudents);
  if (!student) {
    return NextResponse.json({ error: "Bu öğrenci için yetkiniz yok." }, { status: 403 });
  }
  await deleteSupabaseStudent(studentId);
  return NextResponse.json({ ok: true });
}
