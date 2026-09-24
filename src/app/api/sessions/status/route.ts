import {
  applyStudentPostponeRpc,
  isSupabaseConfigured,
  readSupabaseStudioData,
  reviewStudentPostponeRpc,
  upsertSupabasePostponeRequest,
  upsertSupabaseSessionStatus,
  withdrawStudentPostponeRpc,
} from "@/lib/server/supabase-rest";
import { getSessionUser } from "@/lib/server/session";
import { todayISO } from "@/lib/dates";
import { getClassGroupById } from "@/data/groups";
import { remainingPostponeRights } from "@/data/accessors";
import { isAtLeast24HoursAway, weekdayFromISO } from "@/lib/dates";
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
      instructorId: string;
      monthlyPostponeLimit?: number;
      postponeLessonUsed?: boolean;
      postponeLessonUsedAt?: string;
      package?: { startDate?: string; endDate?: string };
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
    const group = getClassGroupById(session.groupId) ?? data.customGroups?.find((item) => item.id === session.groupId);
    const day = weekdayFromISO(session.date);
    const time = (day && group?.timeByDay?.[day]) ?? group?.time ?? "";
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
  const pendingPostpone = data.postponeRequests?.find(
    (item) => item.sessionId === session.id && item.status === "pending",
  );
  // Pending request remains the approval source of truth.
  const approvingPostpone = body.status === "postponed" && Boolean(pendingPostpone);
  const rejectingPostpone =
    body.status === "upcoming" && Boolean(pendingPostpone) && session.status === "postpone_pending";
  if (
    session.date > todayISO() &&
    body.status !== "upcoming" &&
    !approvingPostpone
  ) {
    return NextResponse.json(
      { error: "Gelecekteki dersler bekleniyor olarak kalır." },
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
    return NextResponse.json({ ok: true });
  }

  // Instructor manual session outcome (attended / missed / postponed without pending request).
  await upsertSupabaseSessionStatus(session.id, body.status!);
  if (body.status === "postponed" && !pendingPostpone) {
    const createdAt = new Date().toISOString();
    await upsertSupabasePostponeRequest({
      id: `req-${session.id}-${Date.now()}`,
      studentId: student.id,
      sessionId: session.id,
      reason: body.reason?.trim() || "Eğitmen erteleme işaretledi.",
      status: "approved",
      createdAt,
    });
  }
  return NextResponse.json({ ok: true });
}
