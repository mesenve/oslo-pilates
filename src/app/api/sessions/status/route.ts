import { readStudioSnapshot, writeStudioSnapshot } from "@/app/api/studio/route";
import { getSessionUser } from "@/lib/server/session";
import { NextResponse } from "next/server";

const allowedStatuses = new Set(["attended", "postponed", "missed", "upcoming"]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role === "student") {
    return NextResponse.json({ error: "Bu işlem için eğitmen oturumu gerekli." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { sessionId?: string; status?: string } | null;
  if (!body?.sessionId || !body.status || !allowedStatuses.has(body.status)) {
    return NextResponse.json({ error: "Geçersiz ders durumu." }, { status: 400 });
  }
  const state = await readStudioSnapshot();
  const snapshot = state.snapshot as {
    students?: Array<{ id: string; instructorId: string }>;
    sessions?: Array<{ id: string; studentId: string; status: string }>;
    postponeRequests?: Array<{ sessionId: string; status: string }>;
  } | null;
  const session = snapshot?.sessions?.find((item) => item.id === body.sessionId);
  const student = snapshot?.students?.find((item) => item.id === session?.studentId);
  const sharedPair = ["staff-delfin", "staff-elif"];
  const allowed = user.role === "super_admin" || Boolean(student && (
    student.instructorId === user.id ||
    (sharedPair.includes(student.instructorId) && sharedPair.includes(user.id))
  ));
  if (!session || !allowed || !snapshot) {
    return NextResponse.json({ error: "Bu ders için yetkiniz yok." }, { status: 403 });
  }
  snapshot.sessions = snapshot.sessions?.map((item) =>
    item.id === session.id ? { ...item, status: body.status! } : item,
  );
  if (body.status !== "postponed") {
    snapshot.postponeRequests = snapshot.postponeRequests?.map((item) =>
      item.sessionId === session.id && item.status !== "rejected" ? { ...item, status: "rejected" } : item,
    );
  }
  await writeStudioSnapshot({ configured: true, snapshot });
  return NextResponse.json({ ok: true });
}
