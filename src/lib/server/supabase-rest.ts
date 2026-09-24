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

export async function deleteSupabasePostponeRequest(requestId: string) {
  await request<unknown>(`postpone_requests?id=eq.${encodeURIComponent(requestId)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

/** Single-row upsert so a postpone request cannot be lost if a full snapshot write races. */
export async function upsertSupabasePostponeRequest(row: {
  id: string;
  studentId: string;
  sessionId: string;
  reason: string;
  status: string;
  createdAt: string;
}) {
  await request<unknown>("postpone_requests?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([
      {
        id: row.id,
        student_id: row.studentId,
        session_id: row.sessionId,
        reason: row.reason,
        status: row.status,
        created_at: row.createdAt,
      },
    ]),
  });
}

export async function upsertSupabaseSessionStatus(sessionId: string, status: string) {
  await request<unknown>(`sessions?id=eq.${encodeURIComponent(sessionId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status }),
  });
}

/** Atomically create pending postpone request + set session postpone_pending. */
export async function applyStudentPostponeRpc(input: {
  sessionId: string;
  requestId: string;
  studentId: string;
  reason?: string;
  createdAt?: string;
}) {
  await request<unknown>("rpc/apply_student_postpone", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: input.sessionId,
      p_request_id: input.requestId,
      p_student_id: input.studentId,
      p_reason: input.reason ?? "",
      p_created_at: input.createdAt ?? new Date().toISOString(),
    }),
  });
}

/** Atomically delete postpone request + set session upcoming. */
export async function withdrawStudentPostponeRpc(input: {
  sessionId: string;
  requestId: string;
  studentId: string;
}) {
  await request<unknown>("rpc/withdraw_student_postpone", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: input.sessionId,
      p_request_id: input.requestId,
      p_student_id: input.studentId,
    }),
  });
}

/** Atomically review pending postpone + set session status. */
export async function reviewStudentPostponeRpc(input: {
  sessionId: string;
  studentId: string;
  requestStatus: "approved" | "rejected";
  sessionStatus: string;
}) {
  await request<unknown>("rpc/review_student_postpone", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: input.sessionId,
      p_student_id: input.studentId,
      p_status: input.requestStatus,
      p_session_status: input.sessionStatus,
    }),
  });
}

/** Permanently remove one student and all dependent records. */
export async function deleteSupabaseStudent(studentId: string) {
  const filter = encodeURIComponent(studentId);
  // Delete dependants first; sessions are also protected by a database FK.
  await Promise.all([
    request<unknown>(`attendance_marks?student_id=eq.${filter}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }),
    request<unknown>(`invites?student_id=eq.${filter}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    }),
  ]);
  await request<unknown>(`students?id=eq.${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

export async function listSupabaseInvites() {
  return request<SupabaseInviteRow[]>("invites?select=*&order=created_at.desc");
}

export type SupabaseStaffCredentialRow = {
  staff_id: string;
  password_hash: string;
  updated_at?: string;
};

export async function getSupabaseStaffPasswordHash(staffId: string) {
  const rows = await request<SupabaseStaffCredentialRow[]>(
    `staff_credentials?staff_id=eq.${encodeURIComponent(staffId)}&select=password_hash&limit=1`,
  );
  return rows[0]?.password_hash ?? null;
}

export async function setSupabaseStaffPasswordHash(
  staffId: string,
  passwordHash: string,
) {
  await request<SupabaseStaffCredentialRow[]>(
    "staff_credentials?on_conflict=staff_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([
        {
          staff_id: staffId,
          password_hash: passwordHash,
          updated_at: new Date().toISOString(),
        },
      ]),
    },
  );
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
  const packageValue = (row.package ?? {}) as Student["package"] & {
    history?: Student["packageHistory"];
    renewalRequest?: Student["renewalRequest"];
    changeLog?: Student["changeLog"];
    postponeLessonUsed?: boolean;
    postponeLessonUsedAt?: string;
    postponeLessonNote?: string;
  };
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
    package: packageValue,
    packageHistory: packageValue.history?.length ? packageValue.history : undefined,
    renewalRequest: packageValue.renewalRequest,
    changeLog: packageValue.changeLog,
    monthlyPostponeLimit: Number(row.monthly_postpone_limit ?? 1),
    postponeLessonUsed: packageValue.postponeLessonUsed ?? false,
    postponeLessonUsedAt: packageValue.postponeLessonUsedAt,
    postponeLessonNote: packageValue.postponeLessonNote
      ? String(packageValue.postponeLessonNote)
      : undefined,
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
    // Keep history inside the existing JSONB package column so no destructive
    // schema migration is needed; the UI still exposes it as packageHistory.
    package: {
      ...student.package,
      history: student.packageHistory ?? [],
      renewalRequest: student.renewalRequest ?? null,
      changeLog: student.changeLog ?? [],
      postponeLessonUsed: student.postponeLessonUsed ?? false,
      postponeLessonUsedAt: student.postponeLessonUsedAt ?? null,
      postponeLessonNote: student.postponeLessonNote ?? null,
    },
    monthly_postpone_limit: student.monthlyPostponeLimit,
    account_status: student.accountStatus,
    invite_token: student.inviteToken ?? null,
    invite_expires_at: student.inviteExpiresAt ?? null,
    invited_at: student.invitedAt ?? null,
    archived_at: archived ? new Date().toISOString() : null,
  };
}

export async function writeSupabaseSnapshot(
  snapshot: Pick<StudioState, "students" | "archivedStudents" | "sessions" | "postponeRequests" | "customGroups">,
  options?: {
    /** full = upsert all (server-owned normalize). studioPost = students/groups + new sessions + reason patches only. */
    mode?: "full" | "studioPost";
    previousSessionIds?: Set<string>;
    previousPostponeById?: Map<string, { reason: string }>;
  },
) {
  const mode = options?.mode ?? "full";
  const students = [
    ...snapshot.students.map((student) => studentRow(student, false)),
    ...snapshot.archivedStudents.map((student) => studentRow(student, true)),
  ];
  const customGroups = snapshot.customGroups.map((group) => ({
    id: group.id,
    days: group.days,
    time: group.time,
    capacity: group.capacity,
    label: group.label,
  }));

  // Keep REST payloads small.  A full studio snapshot contains hundreds of
  // sessions; sending them as one request can be rejected by the proxy and
  // leaves the preceding student upsert committed while sessions are lost.
  const upsert = async (table: string, rows: SupabaseRow[], conflict: string) => {
    if (rows.length === 0) return;
    const chunkSize = 100;
    for (let offset = 0; offset < rows.length; offset += chunkSize) {
      await request<SupabaseRow[]>(`${table}?on_conflict=${conflict}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows.slice(offset, offset + chunkSize)),
      });
    }
  };

  await upsert("students", students, "id");
  await upsert("custom_groups", customGroups, "id");

  if (mode === "studioPost") {
    const previousIds = options?.previousSessionIds ?? new Set<string>();
    const newSessions = snapshot.sessions
      .filter((session) => !previousIds.has(session.id))
      .map((session) => ({
        id: session.id,
        student_id: session.studentId,
        group_id: session.groupId,
        session_date: session.date,
        status: session.status,
      }));
    await upsert("sessions", newSessions, "id");

    const previousPostpone = options?.previousPostponeById ?? new Map();
    for (const requestRow of snapshot.postponeRequests) {
      const previous = previousPostpone.get(requestRow.id);
      if (!previous) continue;
      if ((previous.reason ?? "") === (requestRow.reason ?? "")) continue;
      await request<unknown>(`postpone_requests?id=eq.${encodeURIComponent(requestRow.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ reason: requestRow.reason ?? "" }),
      });
    }
    return;
  }

  const sessions = snapshot.sessions.map((session) => ({
    id: session.id,
    student_id: session.studentId,
    group_id: session.groupId,
    session_date: session.date,
    status: session.status,
  }));
  const postponeRequests = snapshot.postponeRequests.map((requestRow) => ({
    id: requestRow.id,
    student_id: requestRow.studentId,
    session_id: requestRow.sessionId,
    reason: requestRow.reason,
    status: requestRow.status,
    created_at: requestRow.createdAt,
  }));
  await upsert("sessions", sessions, "id");
  await upsert("postpone_requests", postponeRequests, "id");
}
