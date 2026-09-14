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

export async function loginStudentAccount(email: string, password: string) {
  const response = await fetch("/api/auth/student", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
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

export async function fetchActivatedInvites(): Promise<
  Array<{ student: Student; sessions: Session[] }>
> {
  const response = await fetch("/api/invite/activated");
  const data = await readJsonResponse<{
    invites?: Array<{ student: Student; sessions: Session[] }>;
    error?: string;
  }>(response);

  if (!response.ok) {
    throw new Error(data.error ?? "Aktif öğrenciler alınamadı.");
  }

  return data.invites ?? [];
}

export async function sendInviteEmail(input: SendInviteEmailInput) {
  const response = await fetch("/api/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = await readJsonResponse<{ error?: string }>(response);

  if (!response.ok) {
    throw new Error(data.error ?? "Davet maili gönderilemedi.");
  }
}

export type ActivatedStudentPayload = {
  student: Student;
  sessions: Session[];
  password?: string;
};

export function buildActivatedMerge(
  payload: ActivatedStudentPayload,
): (current: {
  students: Student[];
  sessions: Session[];
  studentPasswords: Record<string, string>;
}) => {
  students: Student[];
  sessions: Session[];
  studentPasswords: Record<string, string>;
} {
  return (current) => {
    const hasStudent = current.students.some((item) => item.id === payload.student.id);
    const students = hasStudent
      ? current.students.map((item) =>
          item.id === payload.student.id ? payload.student : item,
        )
      : [payload.student, ...current.students];

    const sessions = [
      ...current.sessions.filter((item) => item.studentId !== payload.student.id),
      ...payload.sessions,
    ];

    return {
      students,
      sessions,
      studentPasswords: payload.password
        ? { ...current.studentPasswords, [payload.student.id]: payload.password }
        : current.studentPasswords,
    };
  };
}

