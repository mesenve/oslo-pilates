import type { Session, Student, StudioState } from "@/types/studio";

type SupabaseRow = Record<string, unknown>;

const url = () => process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(url() && key());
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${url()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key(),
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Supabase isteği başarısız (${response.status}).`);
  }
  const body = await response.text();
  return (body ? JSON.parse(body) : undefined) as T;
}

export type SupabaseInviteRow = {
  token: string;
  student_id: string;
  student: Student;
  sessions: Session[];
  expires_at: string;
  password?: string | null;
  activated_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export async function getSupabaseInvite(token: string) {
  const rows = await request<SupabaseInviteRow[]>(
    `invites?token=eq.${encodeURIComponent(token)}&select=*`,
  );
  return rows[0] ?? null;
}

export async function saveSupabaseInvite(invite: SupabaseInviteRow) {
  await request<SupabaseInviteRow[]>("invites?on_conflict=token", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([invite]),
  });
}

export async function deleteSupabaseInvite(token: string) {
  await request<unknown>(`invites?token=eq.${encodeURIComponent(token)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function listSupabaseInvites() {
  return request<SupabaseInviteRow[]>("invites?select=*&order=created_at.desc");
}

export async function activateSupabaseStudent(studentId: string) {
  await request<SupabaseRow[]>(`students?id=eq.${encodeURIComponent(studentId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      account_status: "active",
      invite_token: null,
      invite_expires_at: null,
      updated_at: new Date().toISOString(),
    }),
  });
}

export type SupabaseAttendanceRow = {
  session_id: string;
  student_id: string;
  session_date: string;
  group_id: string;
  status: "attend_pending" | "attended" | "upcoming";
  updated_at?: string;
};

export async function saveSupabaseAttendance(mark: SupabaseAttendanceRow) {
  await request<SupabaseAttendanceRow[]>("attendance_marks?on_conflict=session_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([mark]),
  });
}

export async function listSupabaseAttendance() {
  return request<SupabaseAttendanceRow[]>("attendance_marks?select=*&order=updated_at.desc");
}

function toStudent(row: SupabaseRow): Student {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    email: String(row.email ?? ""),
    phone: String(row.phone ?? ""),
    groupId: String(row.group_id ?? ""),
    instructorId: String(row.instructor_id ?? ""),
    packageType: row.package_type as Student["packageType"],
    note: String(row.note ?? ""),
    measurements: (row.measurements ?? {}) as Student["measurements"],
    package: (row.package ?? {}) as Student["package"],
    monthlyPostponeLimit: Number(row.monthly_postpone_limit ?? 1),
    accountStatus: row.account_status as Student["accountStatus"],
    inviteToken: row.invite_token ? String(row.invite_token) : undefined,
    inviteExpiresAt: row.invite_expires_at ? String(row.invite_expires_at) : undefined,
    invitedAt: row.invited_at ? String(row.invited_at) : undefined,
  };
}

function toSession(row: SupabaseRow): Session {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    groupId: String(row.group_id),
    date: String(row.session_date),
    status: row.status as Session["status"],
  };
}

export async function readSupabaseSnapshot(): Promise<Pick<StudioState, "students" | "archivedStudents" | "sessions" | "postponeRequests" | "customGroups"> & { blockedEmails: string[] }> {
  const [studentRows, sessionRows, postponeRows, groupRows, blockedRows] = await Promise.all([
    request<SupabaseRow[]>("students?select=*&order=name"),
    request<SupabaseRow[]>("sessions?select=*&order=session_date"),
    request<SupabaseRow[]>("postpone_requests?select=*&order=created_at.desc"),
    request<SupabaseRow[]>("custom_groups?select=*&order=label"),
    request<SupabaseRow[]>("blocked_emails?select=email&order=email"),
  ]);

  const allStudents = studentRows.map(toStudent);
  const archivedIds = new Set(
    studentRows.filter((row) => row.archived_at).map((row) => String(row.id)),
  );
  return {
    students: allStudents.filter((student) => !archivedIds.has(student.id)),
    archivedStudents: allStudents.filter((student) => archivedIds.has(student.id)),
    sessions: sessionRows.map(toSession),
    postponeRequests: postponeRows.map((row) => ({
      id: String(row.id),
      studentId: String(row.student_id),
      sessionId: String(row.session_id),
      reason: String(row.reason ?? ""),
      status: row.status as StudioState["postponeRequests"][number]["status"],
      createdAt: String(row.created_at),
    })),
    customGroups: groupRows.map((row) => ({
      id: String(row.id),
      days: (row.days ?? []) as StudioState["customGroups"][number]["days"],
      time: String(row.time ?? ""),
      capacity: Number(row.capacity ?? 2),
      label: String(row.label ?? ""),
    })),
    blockedEmails: blockedRows.map((row) => String(row.email)),
  };
}

function studentRow(student: Student, archived: boolean) {
  return {
    id: student.id,
    name: student.name,
    email: student.email,
    phone: student.phone,
    group_id: student.groupId,
    instructor_id: student.instructorId,
    package_type: student.packageType,
    note: student.note,
    measurements: student.measurements,
    package: student.package,
    monthly_postpone_limit: student.monthlyPostponeLimit,
    account_status: student.accountStatus,
    invite_token: student.inviteToken ?? null,
    invite_expires_at: student.inviteExpiresAt ?? null,
    invited_at: student.invitedAt ?? null,
    archived_at: archived ? new Date().toISOString() : null,
  };
}

export async function writeSupabaseSnapshot(snapshot: Pick<StudioState, "students" | "archivedStudents" | "sessions" | "postponeRequests" | "customGroups">) {
  const students = [
    ...snapshot.students.map((student) => studentRow(student, false)),
    ...snapshot.archivedStudents.map((student) => studentRow(student, true)),
  ];
  const sessions = snapshot.sessions.map((session) => ({
    id: session.id,
    student_id: session.studentId,
    group_id: session.groupId,
    session_date: session.date,
    status: session.status,
  }));
  const postponeRequests = snapshot.postponeRequests.map((request) => ({
    id: request.id,
    student_id: request.studentId,
    session_id: request.sessionId,
    reason: request.reason,
    status: request.status,
    created_at: request.createdAt,
  }));
  const customGroups = snapshot.customGroups.map((group) => ({
    id: group.id,
    days: group.days,
    time: group.time,
    capacity: group.capacity,
    label: group.label,
  }));

  const upsert = (table: string, rows: SupabaseRow[], conflict: string) =>
    rows.length
      ? request<SupabaseRow[]>(`${table}?on_conflict=${conflict}`, {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        })
      : Promise.resolve([]);

  await upsert("students", students, "id");
  await upsert("sessions", sessions, "id");
  await upsert("postpone_requests", postponeRequests, "id");
  await upsert("custom_groups", customGroups, "id");
}
