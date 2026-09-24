import type { Session, Student } from "@/types/studio";
import { hashPassword } from "@/lib/server/staff-credentials";
import {
  getSupabaseInvite,
  activateSupabaseStudent,
  deleteSupabaseInvite,
  isSupabaseConfigured,
  listSupabaseInvites,
  saveSupabaseInvite,
  type SupabaseInviteRow,
} from "@/lib/server/supabase-rest";

export type StoredInvite = {
  token: string;
  student: Student;
  sessions: Session[];
  expiresAt: string;
  password?: string;
  activatedAt?: string;
};

function requireSupabase() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase yapılandırılmamış. Invite işlemleri için SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
  }
}

function fromSupabaseRow(row: SupabaseInviteRow): StoredInvite {
  return {
    token: row.token,
    student: row.student,
    sessions: row.sessions ?? [],
    expiresAt: row.expires_at,
    password: row.password ?? undefined,
    activatedAt: row.activated_at ?? undefined,
  };
}

export async function saveInvite(invite: StoredInvite) {
  requireSupabase();
  const existing = (await listSupabaseInvites()).find((row) => row.student_id === invite.student.id);
  // Keep the existing password/activation when re-saving an invite token.
  // Wiping them on resend locked activated students out of login.
  await saveSupabaseInvite({
    token: invite.token,
    student_id: invite.student.id,
    student: invite.student,
    sessions: invite.sessions,
    expires_at: invite.expiresAt,
    password: invite.password ?? existing?.password ?? null,
    activated_at: invite.activatedAt ?? existing?.activated_at ?? null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (existing && existing.token !== invite.token) {
    await deleteSupabaseInvite(existing.token);
  }
}

export async function getInviteByToken(token: string) {
  requireSupabase();
  const row = await getSupabaseInvite(token);
  return row ? fromSupabaseRow(row) : null;
}

export async function getInviteByStudentId(studentId: string) {
  requireSupabase();
  const rows = await listSupabaseInvites();
  const row = rows.find((item) => item.student_id === studentId);
  return row ? fromSupabaseRow(row) : null;
}

export async function activateInvite(token: string, password: string) {
  requireSupabase();
  const invite = await getInviteByToken(token);
  if (!invite) return null;

  const activated: StoredInvite = {
    ...invite,
    password: await hashPassword(password),
    activatedAt: new Date().toISOString(),
    student: {
      ...invite.student,
      accountStatus: "active",
      inviteToken: undefined,
      inviteExpiresAt: undefined,
    },
  };

  await activateSupabaseStudent(activated.student.id);
  await saveSupabaseInvite({
    token: activated.token,
    student_id: activated.student.id,
    student: activated.student,
    sessions: activated.sessions,
    expires_at: activated.expiresAt,
    password: activated.password,
    activated_at: activated.activatedAt,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return activated;
}

export async function findActivatedInviteByEmail(email: string) {
  requireSupabase();
  const normalized = email.trim().toLowerCase();
  const rows = await listSupabaseInvites();
  const row = rows.find(
    (item) => item.student.email.toLowerCase() === normalized && item.password && item.activated_at,
  );
  return row ? fromSupabaseRow(row) : null;
}

export async function listActivatedInvites() {
  requireSupabase();
  return (await listSupabaseInvites())
    .filter((row) => row.activated_at && row.password)
    .map(fromSupabaseRow);
}

export async function setInvitePassword(studentId: string, password: string) {
  requireSupabase();
  const invite = await getInviteByStudentId(studentId);
  if (!invite) return null;
  const hashed = await hashPassword(password);
  const next: StoredInvite = {
    ...invite,
    password: hashed,
    activatedAt: invite.activatedAt ?? new Date().toISOString(),
    student: {
      ...invite.student,
      accountStatus: "active",
      inviteToken: undefined,
      inviteExpiresAt: undefined,
    },
  };
  await activateSupabaseStudent(studentId);
  await saveSupabaseInvite({
    token: next.token,
    student_id: next.student.id,
    student: next.student,
    sessions: next.sessions,
    expires_at: next.expiresAt,
    password: next.password ?? null,
    activated_at: next.activatedAt ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return next;
}

export function inviteTokenFromUrl(link: string) {
  try {
    return new URL(link).searchParams.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}
