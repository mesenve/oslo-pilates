import { getSessionUser, clearedSessionCookie } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const user = await getSessionUser();
    const response = NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
    if (!user) response.cookies.set(clearedSessionCookie);
    return response;
  } catch {
    return NextResponse.json({
      error: "Oturum doğrulanamadı. Lütfen bağlantınızı kontrol edip tekrar deneyin.",
    }, { status: 503 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedSessionCookie);
  return response;
}
