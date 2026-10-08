import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuthUser } from "@/types/studio";

export const SESSION_SECONDS = 60 * 60 * 24 * 14;
export type SessionPayload = AuthUser & { exp: number; credential: string };

export function credentialStamp(secret: string, password: string, version: number) {
  return createHmac("sha256", secret).update(`${version}:${password}`).digest("base64url");
}

export function encodeSession(user: AuthUser, credential: string, secret: string) {
  const body = Buffer.from(JSON.stringify({
    ...user, credential, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function decodeSession(value: string, secret: string): SessionPayload | null {
  try {
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const [body, signed] = parts;
    const expected = createHmac("sha256", secret).update(body).digest();
    const received = Buffer.from(signed, "base64url");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (typeof session.id !== "string" || !session.id ||
        typeof session.credential !== "string" || !session.credential ||
        !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000) ||
        !["student", "instructor", "super_admin"].includes(session.role)) return null;
    return session;
  } catch {
    return null;
  }
}
