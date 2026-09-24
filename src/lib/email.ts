import { Resend } from "resend";
import { STUDIO_NAME } from "@/lib/studio";
import { getWelcomeEmailContent, getWelcomeEmailHtml } from "@/lib/student-auth";

type InviteRecipient = {
  name: string;
  email: string;
};

export type SendInviteEmailResult =
  | { ok: true }
  | { ok: false; error: string };

async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<SendInviteEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey?.trim()) {
    return {
      ok: false,
      error: "RESEND_API_KEY tanımlı değil. Proje kökündeki .env.local dosyasına ekle.",
    };
  }

  if (!from?.trim()) {
    return {
      ok: false,
      error: "RESEND_FROM_EMAIL tanımlı değil. Proje kökündeki .env.local dosyasına ekle.",
    };
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from: from.trim(),
    to: input.to.trim(),
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function sendWelcomeInviteEmail(
  student: InviteRecipient,
  inviteUrl: string,
): Promise<SendInviteEmailResult> {
  const { subject, body } = getWelcomeEmailContent(student, inviteUrl);
  const html = getWelcomeEmailHtml(student, inviteUrl);
  return sendMail({
    to: student.email,
    subject,
    text: body,
    html,
  });
}

export async function sendPasswordResetEmail(
  student: InviteRecipient,
  resetUrl: string,
): Promise<SendInviteEmailResult> {
  const firstName = student.name.split(" ")[0] || student.name;
  const subject = `${STUDIO_NAME} şifre sıfırlama`;
  const text = [
    `Merhaba ${firstName},`,
    "",
    "Şifreni yenilemek için aşağıdaki linke tıkla:",
    resetUrl,
    "",
    "Bu link 2 saat geçerlidir. Sen istemediysen bu maili yok sayabilirsin.",
    "",
    "Sevgiler,",
    STUDIO_NAME,
  ].join("\n");
  const html = `<!DOCTYPE html>
<html lang="tr">
  <body style="margin:0;padding:24px;background:#fdecef;font-family:Arial,sans-serif;color:#2b1a22;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #f4cdd6;">
      <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c2185b;">${STUDIO_NAME}</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">Şifreni yenile</h1>
      <p style="margin:0 0 20px;line-height:1.6;">Merhaba ${firstName}, şifreni yenilemek için aşağıdaki butona tıkla.</p>
      <p style="margin:0 0 24px;">
        <a href="${resetUrl}" style="display:inline-block;background:#c2185b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600;">
          Yeni şifre belirle
        </a>
      </p>
      <p style="margin:0;line-height:1.6;font-size:14px;color:#8a6570;">Bu link 2 saat geçerlidir.</p>
    </div>
  </body>
</html>`;
  return sendMail({ to: student.email, subject, text, html });
}
