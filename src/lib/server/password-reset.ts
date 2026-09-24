import { createHmac, timingSafeEqual } from "node:crypto";

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

export function createPasswordResetToken(
  kind: PasswordResetKind,
  accountId: string,
  email: string,
) {
  const body = Buffer.from(
    JSON.stringify({
      kind,
      accountId,
      email: email.trim().toLowerCase(),
      exp: Math.floor(Date.now() / 1000) + RESET_MAX_AGE_SECONDS,
    } satisfies ResetPayload),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** @deprecated Prefer createPasswordResetToken("student", …). Kept for call-site clarity. */
export function createStudentPasswordResetToken(studentId: string, email: string) {
  return createPasswordResetToken("student", studentId, email);
}

export function verifyPasswordResetToken(token: string): ResetPayload | null {
  const [body, provided] = token.split(".");
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
        : raw.studentId
          ? "student"
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

export function passwordResetUrl(token: string, origin?: string) {
  const base = origin ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  return `${base.replace(/\/$/, "")}/giris/sifre-yenile?token=${encodeURIComponent(token)}`;
}
