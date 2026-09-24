import { getStaffByEmail, isSuperAdminEmail } from "@/data/staff";
import { resolveStaffPassword } from "@/lib/server/staff-password-store";
import { verifyPassword } from "@/lib/server/staff-credentials";
import { sessionCookie } from "@/lib/server/session";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
  } | null;
  const staff = body?.email ? getStaffByEmail(body.email) : undefined;
  const storedPassword = staff ? await resolveStaffPassword(staff.id) : "";
  if (
    !staff ||
    !body?.password ||
    !(await verifyPassword(body.password, storedPassword))
  ) {
    return NextResponse.json(
      { error: "E-posta veya şifre hatalı." },
      { status: 401 },
    );
  }
  const user = {
    ...staff,
    role: isSuperAdminEmail(staff.email)
      ? ("super_admin" as const)
      : staff.role,
  };
  const response = NextResponse.json({ user });
  response.cookies.set(sessionCookie(user));
  return response;
}
