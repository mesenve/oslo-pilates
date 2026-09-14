import { getStaffByEmail, isSuperAdminEmail } from "@/data/staff";
import { DEFAULT_STAFF_PASSWORDS } from "@/lib/staff-auth";
import { sessionCookie } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const staff = body?.email ? getStaffByEmail(body.email) : undefined;
  if (!staff || !body?.password || body.password !== DEFAULT_STAFF_PASSWORDS[staff.id]) {
    return NextResponse.json({ error: "E-posta veya şifre hatalı." }, { status: 401 });
  }
  const user = { ...staff, role: isSuperAdminEmail(staff.email) ? "super_admin" as const : staff.role };
  const response = NextResponse.json({ user });
  response.cookies.set(sessionCookie(user));
  return response;
}
