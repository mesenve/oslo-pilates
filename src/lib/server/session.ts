import { cookies } from "next/headers";
import { getStaffById } from "@/data/staff";
import { getStudentAccount } from "@/lib/server/supabase-rest";
import { resolveStaffPassword } from "@/lib/server/staff-password-store";
import { credentialStamp, decodeSession, encodeSession, SESSION_SECONDS } from "./session-token";
import type { AuthUser } from "@/types/studio";

const COOKIE_NAME = "oslo_session";

function secret() {
  const value = process.env.OSLO_SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("OSLO_SESSION_SECRET yapılandırılmamış.");
  }
  return value ?? "local-development-session-secret";
}

async function currentAccount(user: Pick<AuthUser, "id" | "role">) {
  if (user.role === "student") {
    const account = await getStudentAccount({ id: user.id });
    if (!account || account.archived || account.student.accountStatus !== "active" ||
        !account.invite?.password || !account.invite.activated_at) return null;
    return {
      user: { id: account.student.id, name: account.student.name,
        email: account.student.email, role: "student" as const },
      credential: credentialStamp(secret(), account.invite.password, account.version),
      password: account.invite.password,
    };
  }
  const staff = getStaffById(user.id);
  if (!staff || staff.role !== user.role) return null;
  const password = await resolveStaffPassword(staff.id);
  if (!password) return null;
  return { user: staff, credential: credentialStamp(secret(), password, 0), password };
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return null;
  const session = decodeSession(value, secret());
  if (!session) return null;
  const account = await currentAccount(session);
  return account?.credential === session.credential ? account.user : null;
}

export async function sessionCookie(user: AuthUser, remember = true, expectedPassword?: string) {
  const account = await currentAccount(user);
  if (!account) throw new Error("Hesap giriş için aktif değil.");
  if (expectedPassword && expectedPassword !== account.password) {
    throw new Error("Giriş bilgileri değişti. Lütfen yeniden giriş yapın.");
  }
  return {
    name: COOKIE_NAME,
    value: encodeSession(account.user, account.credential, secret()),
    httpOnly: true, sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production", path: "/",
    ...(remember ? { maxAge: SESSION_SECONDS } : {}),
  };
}

export const clearedSessionCookie = {
  name: COOKIE_NAME, value: "",
  httpOnly: true, sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0,
};
