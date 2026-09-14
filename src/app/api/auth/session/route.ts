import { getSessionUser, clearedSessionCookie } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ user: await getSessionUser() });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedSessionCookie);
  return response;
}
