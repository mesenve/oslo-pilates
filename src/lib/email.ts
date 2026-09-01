import { Resend } from "resend";
import { getWelcomeEmailContent, getWelcomeEmailHtml } from "@/lib/student-auth";

type InviteRecipient = {
  name: string;
  email: string;
};

export type SendInviteEmailResult =
  | { ok: true }
  | { ok: false; error: string };

export async function sendWelcomeInviteEmail(
  student: InviteRecipient,
  inviteUrl: string,
): Promise<SendInviteEmailResult> {
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
  const { subject, body } = getWelcomeEmailContent(student, inviteUrl);
  const html = getWelcomeEmailHtml(student, inviteUrl);

  const { error } = await resend.emails.send({
    from: from.trim(),
    to: student.email.trim(),
    subject,
    text: body,
    html,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
