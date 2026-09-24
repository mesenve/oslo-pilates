import { canManageStudent } from "@/lib/access";
import { todayISO } from "@/lib/dates";
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
  if (!user || (user.role !== "instructor" && user.role !== "super_admin")) return NextResponse.json({ error: "Yetkiniz yok." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as { studentId?: string; status?: "approved" | "rejected" } | null;
  if (!body?.studentId || !body.status) return NextResponse.json({ error: "Öğrenci ve işlem gerekli." }, { status: 400 });
  const data = await readSupabaseStudioData();
  const student = data.students.find((item) => item.id === body.studentId);
  if (!student || !canManageStudent(user, student.id, data.students)) return NextResponse.json({ error: "Bu öğrenci için yetkiniz yok." }, { status: 403 });
  if (student.renewalRequest?.status !== "pending") return NextResponse.json({ error: "Bekleyen yenileme talebi yok." }, { status: 409 });
  const renewalRequest = { ...student.renewalRequest, status: body.status, actedAt: new Date().toISOString(), actedBy: user.id } as RenewalRequest;
  await patchSupabaseStudentPackage(student.id, { renewalRequest });
  return NextResponse.json({ request: renewalRequest });
}
