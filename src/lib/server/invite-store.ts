import type { Session, Student } from "@/types/studio";
import { hashPassword } from "@/lib/server/staff-credentials";
import {
  getSupabaseInvite,
  getStudentAccount,
  setStudentPasswordRpc,
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
  await saveSupabaseInvite({
    token: invite.token, student_id: invite.student.id,
    student: invite.student, sessions: invite.sessions, expires_at: invite.expiresAt,
  });
}

export async function getInviteByToken(token: string) {
  requireSupabase();
  const row = await getSupabaseInvite(token);
  return row ? fromSupabaseRow(row) : null;
}

export async function getInviteByStudentId(studentId: string) {
  requireSupabase();
  const account = await getStudentAccount({ id: studentId });
  return account?.invite ? {
    ...fromSupabaseRow(account.invite), student: account.student,
  } : null;
}

export async function activateInvite(token: string, password: string) {
  requireSupabase();
  const invite = await getInviteByToken(token);
  if (!invite) return null;
  await setStudentPasswordRpc({
    studentId: invite.student.id, passwordHash: await hashPassword(password), inviteToken: token,
  });
  return getInviteByStudentId(invite.student.id);
}

export async function findActivatedInviteByEmail(email: string) {
  requireSupabase();
  const account = await getStudentAccount({ email });
  if (!account || account.archived || account.student.accountStatus !== "active" ||
      !account.invite?.password || !account.invite.activated_at) return null;
  return { ...fromSupabaseRow(account.invite), student: account.student };
}

export async function listActivatedInvites() {
  requireSupabase();
  return (await listSupabaseInvites())
    .filter((row) => row.activated_at && row.password)
    .map(fromSupabaseRow);
}

export async function setInvitePassword(studentId: string, password: string, resetToken?: string) {
  requireSupabase();
  const invite = await getInviteByStudentId(studentId);
  if (!invite) return null;
  await setStudentPasswordRpc({
    studentId, passwordHash: await hashPassword(password), resetToken,
  });
  return getInviteByStudentId(studentId);
}

export function inviteTokenFromUrl(link: string) {
  try {
    return new URL(link).searchParams.get("token")?.trim() ?? "";
  } catch {
    return "";
  }
}
