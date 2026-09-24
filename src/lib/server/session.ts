import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { AuthUser, Role } from "@/types/studio";

const COOKIE_NAME = "oslo_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days — editing mid-session must not kick staff to home

type SessionPayload = AuthUser & { exp: number };

function secret() {
  const value = process.env.OSLO_SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("OSLO_SESSION_SECRET yapılandırılmamış.");
  }
  return value ?? "local-development-session-secret";
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(user: AuthUser) {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS }),
  ).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

function decode(value: string): AuthUser | null {
  const [payload, providedSignature] = value.split(".");
  if (!payload || !providedSignature) return null;
  const expectedSignature = signature(payload);
  const received = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!session.id || !session.email || !session.name || !session.role) return null;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    if (!["student", "instructor", "super_admin"].includes(session.role as Role)) return null;
    return { id: session.id, email: session.email, name: session.name, role: session.role };
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value ? decode(value) : null;
}

export function sessionCookie(user: AuthUser) {
  return {
    name: COOKIE_NAME,
    value: encode(user),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    },
  };
}

export const clearedSessionCookie = {
  name: COOKIE_NAME,
  value: "",
  options: { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 },
};
