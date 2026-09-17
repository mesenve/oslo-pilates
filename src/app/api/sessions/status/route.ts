import { readStudioSnapshot, snapshotRevision, writeStudioSnapshot } from "@/app/api/studio/route";
import { deleteSupabasePostponeRequest, isSupabaseConfigured } from "@/lib/server/supabase-rest";
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
  const state = await readStudioSnapshot();
  const snapshot = state.snapshot as {
    students?: Array<{ id: string; instructorId: string; monthlyPostponeLimit?: number }>;
    sessions?: Array<{ id: string; studentId: string; groupId: string; date: string; status: string }>;
    postponeRequests?: Array<{ id: string; studentId: string; sessionId: string; reason: string; status: string; createdAt: string }>;
    customGroups?: Array<{ id: string; time: string; timeByDay?: Record<string, string> }>;
  } | null;
  const session = snapshot?.sessions?.find((item) => item.id === body.sessionId);
  const student = snapshot?.students?.find((item) => item.id === session?.studentId);
  if (user.role === "student") {
    if (!snapshot || !session || !student || student.id !== user.id) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }
    if (body.status === "upcoming") {
      const pendingRequest = snapshot.postponeRequests?.find(
        (item) => item.sessionId === session.id && item.status === "pending",
      );
      if (!pendingRequest || !["upcoming", "postpone_pending"].includes(session.status)) {
        return NextResponse.json({ error: "Geri alınabilecek bir erteleme talebi yok." }, { status: 409 });
      }
      snapshot.sessions = snapshot.sessions?.map((item) =>
        item.id === session.id ? { ...item, status: "upcoming" } : item,
      );
      snapshot.postponeRequests = snapshot.postponeRequests?.filter(
        (item) => item.id !== pendingRequest.id,
      );
      await writeStudioSnapshot({ configured: true, snapshot });
      if (isSupabaseConfigured()) {
        await deleteSupabasePostponeRequest(pendingRequest.id);
      }
      return NextResponse.json({ ok: true, revision: snapshotRevision(snapshot) });
    }
    if (body.status !== "postpone_pending") {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }
    const existingPendingRequest = snapshot.postponeRequests?.some(
      (item) => item.sessionId === session.id && item.status === "pending",
    );
    if (existingPendingRequest) {
      return NextResponse.json({ error: "Bu ders için zaten bekleyen bir erteleme talebiniz var." }, { status: 409 });
    }
    if (session.status !== "upcoming") {
      return NextResponse.json({ error: "Bu ders için erteleme yapılamaz." }, { status: 409 });
    }
    const group = getClassGroupById(session.groupId) ?? snapshot.customGroups?.find((item) => item.id === session.groupId);
    const day = weekdayFromISO(session.date);
    const time = (day && group?.timeByDay?.[day]) ?? group?.time ?? "";
    const hasRight = remainingPostponeRights(
      { ...(student as Student), monthlyPostponeLimit: 1 },
      (snapshot.postponeRequests ?? []) as StudioState["postponeRequests"],
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
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    snapshot.sessions = snapshot.sessions?.map((item) =>
      item.id === session.id ? { ...item, status: "postpone_pending" } : item,
    );
    snapshot.postponeRequests = [nextRequest, ...(snapshot.postponeRequests ?? [])];
    await writeStudioSnapshot({ configured: true, snapshot });
    return NextResponse.json({ ok: true, request: nextRequest, revision: snapshotRevision(snapshot) });
  }
  const sharedPair = ["staff-delfin", "staff-elif"];
  const allowed = user.role === "super_admin" || Boolean(student && (
    student.instructorId === user.id ||
    (sharedPair.includes(student.instructorId) && sharedPair.includes(user.id))
  ));
  if (!session || !allowed || !snapshot) {
    return NextResponse.json({ error: "Bu ders için yetkiniz yok." }, { status: 403 });
  }
  const pendingPostpone = snapshot.postponeRequests?.find(
    (item) => item.sessionId === session.id && item.status === "pending",
  );
  const approvingPostpone = body.status === "postponed" &&
    session.status === "postpone_pending" &&
    Boolean(pendingPostpone);
  if (session.date > todayISO() && body.status !== "upcoming" && !approvingPostpone) {
    return NextResponse.json(
      { error: "Gelecekteki dersler bekleniyor olarak kalır." },
      { status: 400 },
    );
  }
  snapshot.sessions = snapshot.sessions?.map((item) =>
    item.id === session.id ? { ...item, status: body.status! } : item,
  );
  snapshot.postponeRequests = snapshot.postponeRequests?.map((item) => {
    if (item.sessionId !== session.id || item.status !== "pending") return item;
    return {
      ...item,
      status: approvingPostpone ? "approved" : "rejected",
      actedAt: new Date().toISOString(),
      actedBy: user.id,
    };
  });
  await writeStudioSnapshot({ configured: true, snapshot });
  return NextResponse.json({ ok: true, revision: snapshotRevision(snapshot) });
}
