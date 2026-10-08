import { canManageStudent } from "@/lib/access";
import { todayISO } from "@/lib/dates";
import { renewalStartDate } from "@/lib/package-period";
import { startRenewedPackage } from "@/lib/server/renewal";
import {
  patchSupabaseStudentPackage,
  readSupabaseStudioData,
} from "@/lib/server/supabase-rest";
import { getSessionUser } from "@/lib/server/session";
import type { RenewalRequest } from "@/types/studio";
import { NextResponse } from "next/server";

function validDate(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

function isScheduledApproval(student: {
  package: { startDate: string };
  renewalRequest?: RenewalRequest | null;
}) {
  const scheduled = student.renewalRequest;
  return Boolean(
    scheduled?.status === "approved" &&
      scheduled.startDate &&
      scheduled.startDate > student.package.startDate,
  );
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "student") return NextResponse.json({ error: "Öğrenci oturumu gerekli." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { requestedStartDate?: string } | null;
  const data = await readSupabaseStudioData();
  const student = data.students.find((item) => item.id === user.id);
  if (!student) return NextResponse.json({ error: "Öğrenci bulunamadı." }, { status: 404 });
  if (student.renewalRequest?.status === "pending") {
    return NextResponse.json({ error: "Bekleyen yenileme talebiniz zaten var." }, { status: 409 });
  }

  const scheduled = student.renewalRequest;
  if (isScheduledApproval(student) && scheduled?.startDate) {
    // Still in the future: member must wait.
    if (scheduled.startDate > todayISO()) {
      return NextResponse.json({ error: "Yenilemen zaten onaylandı." }, { status: 409 });
    }
    // Due but not applied (silent applyDueRenewals failure): retry, then clear the stuck approval.
    try {
      const result = await startRenewedPackage(student, data, {
        ...scheduled,
        startDate: scheduled.startDate,
      });
      if (!("error" in result)) {
        const refreshed = await readSupabaseStudioData();
        return NextResponse.json({
          request: scheduled,
          applied: true,
          student: refreshed.students.find((item) => item.id === student.id),
          sessions: refreshed.sessions.filter((item) => item.studentId === student.id),
        });
      }
      console.error(`Stuck renewal retry failed for ${student.id}: ${result.error}`);
    } catch (error) {
      console.error(`Stuck renewal retry failed for ${student.id}:`, error);
    }
    // Fall through and replace the stuck approval with a fresh pending request.
  }

  const requestedStartDate = validDate(body?.requestedStartDate);
  if (requestedStartDate && requestedStartDate < todayISO()) {
    return NextResponse.json({ error: "Başlangıç tarihi bugün veya sonrası olmalı." }, { status: 400 });
  }
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
    return NextResponse.json({ request: renewalRequest, student: { ...student, renewalRequest } });
  }

  // The current package keeps its remaining lessons; the new one starts once it ends.
  const approved = { ...renewalRequest, startDate: renewalStartDate(student, todayISO()) };
  if (approved.startDate > todayISO()) {
    await patchSupabaseStudentPackage(student.id, { renewalRequest: approved });
    return NextResponse.json({ request: approved, student: { ...student, renewalRequest: approved } });
  }

  try {
    const result = await startRenewedPackage(student, data, approved);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  } catch (error) {
    console.error("Renewal approve failed:", error);
    return NextResponse.json(
      { error: "Paket yenilenemedi. Tekrar dene." },
      { status: 500 },
    );
  }

  const refreshed = await readSupabaseStudioData();
  return NextResponse.json({
    request: approved,
    student: refreshed.students.find((item) => item.id === student.id),
    sessions: refreshed.sessions.filter((item) => item.studentId === student.id),
  });
}
