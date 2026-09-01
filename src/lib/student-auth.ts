import { STUDIO_NAME } from "@/lib/studio";
import type { Student } from "@/types/studio";

export const INVITE_VALID_HOURS = 48;

export const DEFAULT_STUDENT_PASSWORDS: Record<string, string> = {
  "stu-merve": "pilates",
};

export function createInviteToken() {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
}

export function inviteExpiresAt(from = new Date()) {
  const next = new Date(from);
  next.setHours(next.getHours() + INVITE_VALID_HOURS);
  return next.toISOString();
}

export function getStudentPassword(
  studentId: string,
  passwords: Record<string, string> | undefined,
) {
  return passwords?.[studentId] ?? DEFAULT_STUDENT_PASSWORDS[studentId] ?? "";
}

export function hydrateStudentPasswords(
  passwords: Record<string, string> | undefined,
) {
  return { ...DEFAULT_STUDENT_PASSWORDS, ...passwords };
}

export function isInviteValid(student: Student) {
  if (student.accountStatus !== "invited") return false;
  if (!student.inviteToken || !student.inviteExpiresAt) return false;
  return new Date(student.inviteExpiresAt) > new Date();
}

export function inviteUrl(token: string, origin?: string) {
  const base =
    origin ??
    (typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "");
  return `${base}/davet?token=${encodeURIComponent(token)}`;
}

export function findStudentByInviteToken(students: Student[], token: string) {
  return students.find((student) => student.inviteToken === token);
}

export function getWelcomeEmailContent(
  student: Pick<Student, "name" | "email">,
  link: string,
) {
  return {
    subject: `${STUDIO_NAME}'e hoş geldin, ${student.name.split(" ")[0]}`,
    body: [
      `Merhaba ${student.name},`,
      "",
      `${STUDIO_NAME} ailesine hoş geldin.`,
      "",
      "Üye olma adımına devam etmek için lütfen aşağıdaki linke tıkla:",
      link,
      "",
      `Bu link ${INVITE_VALID_HOURS} saat geçerlidir.`,
      "",
      "Sevgiler,",
      STUDIO_NAME,
    ].join("\n"),
  };
}

export function getWelcomeEmailHtml(
  student: Pick<Student, "name" | "email">,
  link: string,
) {
  const firstName = student.name.split(" ")[0];

  return `<!DOCTYPE html>
<html lang="tr">
  <body style="margin:0;padding:24px;background:#fdecef;font-family:Arial,sans-serif;color:#2b1a22;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #f4cdd6;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c2185b;">${STUDIO_NAME}</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;color:#2b1a22;">Hoş geldin, ${firstName}</h1>
      <p style="margin:0 0 12px;line-height:1.6;">${STUDIO_NAME} ailesine hoş geldin.</p>
      <p style="margin:0 0 20px;line-height:1.6;">Üye olma adımına devam etmek için aşağıdaki butona tıkla:</p>
      <p style="margin:0 0 24px;">
        <a href="${link}" style="display:inline-block;background:#c2185b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">
          Şifremi oluştur
        </a>
      </p>
      <p style="margin:0 0 12px;line-height:1.6;font-size:14px;color:#8a6570;">Buton çalışmazsa bu linki tarayıcıya yapıştır:</p>
      <p style="margin:0 0 20px;line-height:1.6;font-size:14px;word-break:break-all;">
        <a href="${link}" style="color:#c2185b;">${link}</a>
      </p>
      <p style="margin:0;line-height:1.6;font-size:14px;color:#8a6570;">Bu link ${INVITE_VALID_HOURS} saat geçerlidir.</p>
    </div>
  </body>
</html>`;
}

export function validateStudentPassword(password: string, confirmPassword: string) {
  if (password.length < 6) {
    return "Şifre en az 6 karakter olmalı.";
  }
  if (password !== confirmPassword) {
    return "Şifreler eşleşmiyor.";
  }
  return null;
}
