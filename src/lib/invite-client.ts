import type { Session, Student } from "@/types/studio";

export type InviteLookup = {
  found: boolean;
  expired: boolean;
  active: boolean;
  student?: Pick<Student, "name" | "email" | "accountStatus">;
};

export async function fetchInviteByToken(token: string): Promise<InviteLookup> {
  const response = await fetch(`/api/invite?token=${encodeURIComponent(token)}`);
  if (response.status === 404) {
    return { found: false, expired: false, active: false };
  }
  if (!response.ok) {
    throw new Error("Davet bilgisi alınamadı.");
  }
  return (await response.json()) as InviteLookup;
}

export async function activateInviteAccount(input: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  const response = await fetch("/api/invite/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as {
    error?: string;
    student?: Student;
    sessions?: Session[];
  };

  if (!response.ok) {
    throw new Error(data.error ?? "Hesap oluşturulamadı.");
  }

  if (!data.student || !data.sessions) {
    throw new Error("Hesap oluşturulamadı.");
  }

  return {
    student: data.student,
    sessions: data.sessions,
  };
}

export async function loginStudentAccount(email: string, password: string, rememberMe = true) {
  const response = await fetch("/api/auth/student", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, rememberMe }),
    signal: AbortSignal.timeout(30000),
  });

  const data = (await response.json()) as {
    error?: string;
    student?: Student;
    sessions?: Session[];
  };

  if (!response.ok) {
    return { error: data.error ?? "E-posta veya şifre hatalı.", payload: null };
  }

  if (!data.student || !data.sessions) {
    return { error: "E-posta veya şifre hatalı.", payload: null };
  }

  return {
    error: null,
    payload: {
      student: data.student,
      sessions: data.sessions,
    },
  };
}

export type SendInviteEmailInput = {
  name: string;
  email: string;
  inviteUrl: string;
  student: Student;
  sessions: Session[];
  expiresAt: string;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("Sunucudan geçerli yanıt alınamadı.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Sunucudan geçerli yanıt alınamadı.");
  }
}

export async function sendInviteEmail(input: SendInviteEmailInput) {
  await saveInvite(input, true);
}

export async function saveInviteLink(input: SendInviteEmailInput) {
  await saveInvite(input, false);
}

async function saveInvite(input: SendInviteEmailInput, sendEmail: boolean) {
  const response = await fetch("/api/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, sendEmail }),
  });

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(data.error ?? "Davet linki kaydedilemedi.");
  }
}
