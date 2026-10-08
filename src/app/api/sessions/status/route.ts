import {
  applyStudentPostponeRpc,
  isSupabaseConfigured,
  patchSupabaseAttendanceStatus,
  readSupabaseStudioData,
  patchSupabasePostponeStatus,
  reviewStudentPostponeRpc,
  upsertSupabasePostponeRequest,
  upsertSupabaseSessionStatus,
  withdrawStudentPostponeRpc,
} from "@/lib/server/supabase-rest";
import { syncRemainingSessions } from "@/lib/server/remaining-sessions";
import { getSessionUser } from "@/lib/server/session";
import { todayISO } from "@/lib/dates";
import { remainingPostponeRights, sessionTimeForStudent } from "@/data/accessors";
import { isAtLeast24HoursAway } from "@/lib/dates";
import { INSTRUCTOR_POSTPONE_PLACEHOLDER } from "@/lib/postpone-note";
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
      return NextResponse.json({ ok: true });
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
    if (!hasRight) {
      return NextResponse.json({ error: "Bu pakette erteleme hakkın kalmadı." }, { status: 409 });
    }
    if (!time.trim()) {
      return NextResponse.json(
        { error: "Ders saati tanımlı değil. Erteleme için stüdyoyla iletişime geç." },
        { status: 409 },
      );
    }
    if (!isAtLeast24HoursAway(session.date, time)) {
      return NextResponse.json({ error: "Ders başlangıcına 24 saatten az kaldığı için ertelenemez." }, { status: 409 });
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
  const activePostpone = data.postponeRequests?.find(
    (item) => item.sessionId === session.id && item.status !== "rejected",
  );
  const pendingPostpone = activePostpone?.status === "pending"
    ? activePostpone
    : undefined;
  // Pending request remains the approval source of truth.
  const approvingPostpone = body.status === "postponed" && Boolean(pendingPostpone);
  const rejectingPostpone =
    body.status === "upcoming" && Boolean(pendingPostpone) && session.status === "postpone_pending";
  if (
    session.date > todayISO() &&
    body.status !== "upcoming" &&
    body.status !== "postponed" &&
    !approvingPostpone
  ) {
    return NextResponse.json(
      { error: "Gelecekteki dersler yalnızca bekleniyor veya ertelendi olabilir." },
      { status: 400 },
    );
  }

  if (approvingPostpone || rejectingPostpone) {
    await reviewStudentPostponeRpc({
      sessionId: session.id,
      studentId: student.id,
      requestStatus: approvingPostpone ? "approved" : "rejected",
      sessionStatus: body.status!,
    });
    if (body.status === "upcoming") {
      await patchSupabaseAttendanceStatus(session.id, "upcoming");
    }
    await syncRemainingSessions(student, data.sessions ?? [], [
      { sessionId: session.id, status: body.status },
    ]);
    return NextResponse.json({ ok: true });
  }

  // Manual status change that should close a dangling pending postpone.
  if (
    pendingPostpone &&
    (body.status === "attended" || body.status === "missed" || body.status === "upcoming")
  ) {
    await reviewStudentPostponeRpc({
      sessionId: session.id,
      studentId: student.id,
      requestStatus: "rejected",
      sessionStatus: body.status,
    });
    if (body.status === "attended") {
      await patchSupabaseAttendanceStatus(session.id, "attended");
    } else {
      await patchSupabaseAttendanceStatus(session.id, "upcoming");
    }
    await syncRemainingSessions(student, data.sessions ?? [], [
      { sessionId: session.id, status: body.status },
    ]);
    return NextResponse.json({ ok: true });
  }

  // Instructor manual session outcome (attended / missed / postponed without pending request).
  if (body.status === "postponed" && !pendingPostpone && activePostpone) {
    await upsertSupabaseSessionStatus(session.id, "postponed");
    await patchSupabaseAttendanceStatus(session.id, "upcoming");
    await syncRemainingSessions(student, data.sessions ?? [], [
      { sessionId: session.id, status: body.status },
    ]);
    return NextResponse.json({ ok: true, request: activePostpone });
  }
  if (
    activePostpone &&
    (body.status === "attended" || body.status === "missed" || body.status === "upcoming")
  ) {
    await patchSupabasePostponeStatus(activePostpone.id, "rejected");
  }
  await upsertSupabaseSessionStatus(session.id, body.status!);
  if (body.status === "attended") {
    await patchSupabaseAttendanceStatus(session.id, "attended");
  } else if (body.status === "upcoming" || body.status === "missed" || body.status === "postponed") {
    // A manual instructor result supersedes a stale student request. Do not
    // create a mark when none exists; only close an existing one.
    await patchSupabaseAttendanceStatus(session.id, "upcoming");
  }
  await syncRemainingSessions(student, data.sessions ?? [], [
      { sessionId: session.id, status: body.status },
    ]);
  if (body.status === "postponed" && !pendingPostpone) {
    const createdAt = new Date().toISOString();
    const request = {
      id: `req-${session.id}-${Date.now()}`,
      studentId: student.id,
      sessionId: session.id,
      reason: body.reason?.trim() || INSTRUCTOR_POSTPONE_PLACEHOLDER,
      status: "approved" as const,
      createdAt,
    };
    // Paket başına tek aktif erteleme: eski onaylı/pending talepleri kapat.
    const otherActive = (data.postponeRequests ?? []).filter(
      (item) =>
        item.studentId === student.id &&
        item.sessionId !== session.id &&
        item.status !== "rejected",
    );
    for (const item of otherActive) {
      await patchSupabasePostponeStatus(item.id, "rejected");
      await upsertSupabaseSessionStatus(item.sessionId, "upcoming");
    }
    await upsertSupabasePostponeRequest({
      id: request.id,
      studentId: request.studentId,
      sessionId: request.sessionId,
      reason: request.reason,
      status: request.status,
      createdAt: request.createdAt,
    });
    return NextResponse.json({ ok: true, request });
  }
  return NextResponse.json({ ok: true });
}
