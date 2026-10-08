import {
  applyStudentPostponeRpc,
  setSessionOutcomeRpc,
  isSupabaseConfigured,
  readSupabaseStudioData,
  readSupabaseStudent,
  withdrawStudentPostponeRpc,
} from "@/lib/server/supabase-rest";
import { getSessionUser } from "@/lib/server/session";
import { todayISO } from "@/lib/dates";
import { remainingPostponeRights, sessionTimeForStudent } from "@/data/accessors";
import { isAtLeast24HoursAway } from "@/lib/dates";
import type { Student, StudioState } from "@/types/studio";
import { NextResponse } from "next/server";

const allowedStatuses = new Set(["attended", "postponed", "missed", "upcoming", "postpone_pending"]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { sessionId?: string; status?: string; reason?: string } | null;
  if (!body?.sessionId || !body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Geçersiz ders durumu." }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  }

  const studio = await readSupabaseStudioData();
  const data = studio as {
    students?: Array<{
      id: string;
      groupId: string;
      instructorId: string;
      monthlyPostponeLimit?: number;
      postponeLessonUsed?: boolean;
      postponeLessonUsedAt?: string;
      package?: {
        totalSessions?: number;
        startDate?: string;
        endDate?: string;
        customSchedule?: { time?: string };
      };
    }>;
    sessions?: Array<{ id: string; studentId: string; groupId: string; date: string; status: string }>;
    postponeRequests?: Array<{ id: string; studentId: string; sessionId: string; reason: string; status: string; createdAt: string }>;
    customGroups?: Array<{ id: string; time: string; timeByDay?: Record<string, string> }>;
  } | null;
  const session = data?.sessions?.find((item) => item.id === body.sessionId);
  const student = data?.students?.find((item) => item.id === session?.studentId);
  if (user.role === "student") {
    if (!data || !session || !student || student.id !== user.id) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }
    if (body.status === "upcoming") {
      const pendingRequest = data.postponeRequests?.find(
        (item) => item.sessionId === session.id && item.status === "pending",
      );
      if (!pendingRequest || !["upcoming", "postpone_pending"].includes(session.status)) {
        return NextResponse.json({ error: "Geri alınabilecek bir erteleme talebi yok." }, { status: 409 });
      }
      await withdrawStudentPostponeRpc({
        sessionId: session.id,
        requestId: pendingRequest.id,
        studentId: student.id,
      });
      return NextResponse.json({ ok: true, student: await readSupabaseStudent(student.id) });
    }
    if (body.status !== "postpone_pending") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }
    const existingPendingRequest = data.postponeRequests?.some(
      (item) => item.sessionId === session.id && item.status === "pending",
    );
    if (existingPendingRequest) {
      return NextResponse.json({ error: "Bu ders için zaten bekleyen bir erteleme talebiniz var." }, { status: 409 });
    }
    if (session.status !== "upcoming") {
      return NextResponse.json({ error: "Bu ders için erteleme yapılamaz." }, { status: 409 });
    }
    const time = sessionTimeForStudent(student, session);
    const hasRight = remainingPostponeRights(
      student as Student,
      (data.postponeRequests ?? []) as StudioState["postponeRequests"],
      (data.sessions ?? []) as StudioState["sessions"],
    ) > 0;
    if (!hasRight || !isAtLeast24HoursAway(session.date, time)) {
      return NextResponse.json({ error: "Erteleme koşulları sağlanmıyor." }, { status: 409 });
    }
    const nextRequest = {
      id: `req-${session.id}-${Date.now()}`,
      studentId: user.id,
      sessionId: session.id,
      // Öğrenci akışında gerekçe alanı yok; geçmişte alanı korumak için boş
      // string saklanır. Hoca tarafından eklenen notlar ayrı tutulabilir.
      reason: body.reason?.trim() ?? "",
      status: "pending" as const,
      createdAt: new Date().toISOString(),
    };
    await applyStudentPostponeRpc({
      sessionId: session.id,
      requestId: nextRequest.id,
      studentId: student.id,
      reason: nextRequest.reason,
      createdAt: nextRequest.createdAt,
    });
    return NextResponse.json({
      ok: true,
      request: nextRequest,
      student: await readSupabaseStudent(student.id),
    });
  }

  const sharedPair = ["staff-delfin", "staff-elif"];
  const allowed = user.role === "super_admin" || Boolean(student && (
    student.instructorId === user.id ||
    (sharedPair.includes(student.instructorId) && sharedPair.includes(user.id))
  ));
  if (!session || !student || !allowed || !data) {
    return NextResponse.json({ error: "Bu ders için yetkiniz yok." }, { status: 403 });
  }
  if (session.date > todayISO() && (body.status === "attended" || body.status === "missed")) {
    return NextResponse.json({ error: "Gelecekteki dersler geldi veya yandı olarak işaretlenemez." }, { status: 400 });
  }
  if (body.status === "postpone_pending") {
    return NextResponse.json({ error: "Erteleme talebini öğrenci göndermelidir." }, { status: 400 });
  }
  await setSessionOutcomeRpc(session.id, body.status, user, body.reason?.trim());
  const refreshed = await readSupabaseStudioData();
  const updatedRequest = refreshed.postponeRequests.find(
    (item) => item.sessionId === session.id && item.status === "approved",
  );
  return NextResponse.json({ ok: true, request: updatedRequest, student: await readSupabaseStudent(student.id) });
}
