import { canManageStudent } from "@/lib/access";
import {
  patchSupabasePostponeReason,
  readSupabaseStudioData,
} from "@/lib/server/supabase-rest";
import { getSessionUser } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user || (user.role !== "super_admin" && user.role !== "instructor")) {
    return NextResponse.json({ error: "Yönetici oturumu gerekli." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    requestId?: string;
    reason?: string;
  } | null;
  const requestId = body?.requestId?.trim();
  if (!requestId || typeof body?.reason !== "string") {
    return NextResponse.json({ error: "Talep ve not gerekli." }, { status: 400 });
  }

  const data = await readSupabaseStudioData();
  const postpone = data.postponeRequests.find((item) => item.id === requestId);
  if (
    !postpone ||
    !canManageStudent(user, postpone.studentId, data.students)
  ) {
    return NextResponse.json({ error: "Bu talep için yetkiniz yok." }, { status: 403 });
  }

  const reason = body.reason.trim();
  await patchSupabasePostponeReason(requestId, reason);
  return NextResponse.json({ ok: true, reason });
}
