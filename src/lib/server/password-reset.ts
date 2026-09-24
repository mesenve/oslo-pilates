import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  consumeSupabasePasswordResetToken,
  getSupabasePasswordResetToken,
  insertSupabasePasswordResetToken,
  isSupabaseConfigured,
} from "@/lib/server/supabase-rest";

const RESET_MAX_AGE_SECONDS = 60 * 60 * 2; // 2 hours

export type PasswordResetKind = "student" | "staff";

export type ResetPayload = {
  kind: PasswordResetKind;
  accountId: string;
  email: string;
  exp: number;
};

function secret() {
  const value = process.env.OSLO_SESSION_SECRET;
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("OSLO_SESSION_SECRET yapılandırılmamış.");
  }
  return value ?? "local-development-session-secret";
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Opaque DB token in production; HMAC fallback for local without Supabase. */
export async function createPasswordResetToken(
  kind: PasswordResetKind,
  accountId: string,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + RESET_MAX_AGE_SECONDS;

  if (isSupabaseConfigured()) {
    const token = randomBytes(32).toString("base64url");
    await insertSupabasePasswordResetToken({
      token,
      kind,
      account_id: accountId,
      email: normalizedEmail,
      expires_at: new Date(exp * 1000).toISOString(),
    });
    return token;
  }

  const body = Buffer.from(
    JSON.stringify({
      kind,
      accountId,
      email: normalizedEmail,
      exp,
    } satisfies ResetPayload),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** @deprecated Prefer createPasswordResetToken("student", …). Kept for call-site clarity. */
export async function createStudentPasswordResetToken(
  studentId: string,
  email: string,
) {
  return createPasswordResetToken("student", studentId, email);
}

export async function verifyPasswordResetToken(
  token: string,
): Promise<ResetPayload | null> {
  const value = token.trim();
  if (!value) return null;

  if (isSupabaseConfigured() && !value.includes(".")) {
    const row = await getSupabasePasswordResetToken(value);
    if (!row || row.used_at) return null;
    const exp = Math.floor(new Date(row.expires_at).getTime() / 1000);
    if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    if (row.kind !== "student" && row.kind !== "staff") return null;
    return {
      kind: row.kind,
      accountId: row.account_id,
      email: row.email,
      exp,
    };
  }

  const [body, provided] = value.split(".");
  if (!body || !provided) return null;
  const expected = sign(body);
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const raw = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<ResetPayload> & { studentId?: string };
    const accountId = raw.accountId ?? raw.studentId;
    const kind: PasswordResetKind =
      raw.kind === "staff" || raw.kind === "student"
        ? raw.kind
        : "student";
    if (!accountId || !raw.email || !raw.exp) return null;
    if (raw.exp <= Math.floor(Date.now() / 1000)) return null;
    return {
      kind,
      accountId,
      email: raw.email,
      exp: raw.exp,
    };
  } catch {
    return null;
  }
}

export async function consumePasswordResetToken(token: string) {
  const value = token.trim();
  if (!value || value.includes(".")) return;
  if (!isSupabaseConfigured()) return;
  await consumeSupabasePasswordResetToken(value);
}

export function passwordResetUrl(token: string, origin?: string) {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base.replace(/\/$/, "")}/giris/sifre-yenile?token=${encodeURIComponent(token)}`;
}
