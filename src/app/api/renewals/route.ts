import { canManageStudent } from "@/lib/access";
import { getClassGroupById, isPresetGroupId } from "@/data/groups";
import { buildSessionsForStudent } from "@/data/seed";
import { todayISO } from "@/lib/dates";
import {
  patchSupabaseStudentPackage,
  readSupabaseStudioData,
  saveSupabaseStudentBundle,
} from "@/lib/server/supabase-rest";
import { getSessionUser } from "@/lib/server/session";
import type { PackageHistoryEntry, RenewalRequest, Student } from "@/types/studio";
import { NextResponse } from "next/server";

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "student") return NextResponse.json({ error: "Öğrenci oturumu gerekli." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { requestedStartDate?: string } | null;
  const data = await readSupabaseStudioData();
  const student = data.students.find((item) => item.id === user.id);
  if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
  if (student.renewalRequest?.status === "pending") return NextResponse.json({ error: "Bekleyen yenileme talebiniz zaten var." }, { status: 409 });
  const requestedStartDate = validDate(body?.requestedStartDate);
  if (requestedStartDate && requestedStartDate < todayISO()) return NextResponse.json({ error: "Başlangıç tarihi bugün veya sonrası olmalı." }, { status: 400 });
  const renewalRequest: RenewalRequest = {
    id: `renew-${student.id}-${Date.now()}`,
    requestedStartDate,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await patchSupabaseStudentPackage(student.id, { renewalRequest });
  return NextResponse.json({ request: renewalRequest });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "instructor" && user.role !== "super_admin")) {
    return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    studentId?: string;
    status?: "approved" | "rejected";
  } | null;
  if (!body?.studentId || !body.status) {
    return NextResponse.json({ error: "Öğrenci ve işlem gerekli." }, { status: 400 });
  }
  const data = await readSupabaseStudioData();
  const student = data.students.find((item) => item.id === body.studentId);
  if (!student || !canManageStudent(user, student.id, data.students)) {
    return NextResponse.json({ error: "Bu öğrenci için yetkiniz yok." }, { status: 403 });
  }
  if (student.renewalRequest?.status !== "pending") {
    return NextResponse.json({ error: "Bekleyen yenileme talebi yok." }, { status: 409 });
  }

  const renewalRequest: RenewalRequest = {
    ...student.renewalRequest,
    status: body.status,
    actedAt: new Date().toISOString(),
    actedBy: user.id,
  };

  if (body.status === "rejected") {
    await patchSupabaseStudentPackage(student.id, { renewalRequest });
    return NextResponse.json({ request: renewalRequest, student });
  }

  // Approve = start a new package period (not just flip the request flag).
  const startDate =
    validDate(student.renewalRequest.requestedStartDate) &&
    student.renewalRequest.requestedStartDate! >= todayISO()
      ? student.renewalRequest.requestedStartDate!
      : todayISO();
  const historyEntry: PackageHistoryEntry = {
    ...student.package,
    id: `pkg-${student.id}-${student.package.startDate}`,
    createdAt: student.package.startDate,
    endedAt: new Date().toISOString(),
  };
  const renewed: Student = {
    ...student,
    package: {
      ...student.package,
      startDate,
      remainingSessions: student.package.totalSessions,
      isLastWeek: false,
      paymentStatus: student.package.paymentStatus,
    },
    packageHistory: [historyEntry, ...(student.packageHistory ?? [])],
    renewalRequest,
    postponeLessonUsed: false,
    postponeLessonUsedAt: undefined,
    postponeLessonNote: undefined,
  };
  const group = isPresetGroupId(renewed.groupId)
    ? getClassGroupById(renewed.groupId)
    : data.customGroups.find((item) => item.id === renewed.groupId);
  const sessions = buildSessionsForStudent(renewed, {
    fromPackageStart: true,
    group,
  });
  if (sessions.length !== renewed.package.totalSessions) {
    return NextResponse.json(
      { error: "Yeni paket seansları oluşturulamadı. Program günlerini kontrol et." },
      { status: 400 },
    );
  }
  renewed.package.endDate = sessions.at(-1)!.date;

  try {
    await saveSupabaseStudentBundle({
      student: renewed,
      sessions,
    });
  } catch (error) {
    console.error("Renewal approve failed:", error);
    return NextResponse.json(
      { error: "Paket yenilenemedi. Tekrar dene." },
      { status: 500 },
    );
  }

  const refreshed = await readSupabaseStudioData();
  const persisted =
    refreshed.students.find((item) => item.id === student.id) ?? renewed;
  const persistedSessions = refreshed.sessions.filter(
    (item) => item.studentId === student.id,
  );
  return NextResponse.json({
    request: renewalRequest,
    student: persisted,
    sessions: persistedSessions,
  });
}
