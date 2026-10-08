import type { ClassGroup, Session, Student, StudioState } from "@/types/studio";

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
    signal: init?.signal ?? AbortSignal.timeout(15000),
  });
  const body = await response.text();
  if (!response.ok) {
    let detail = body;
    try {
      const payload = JSON.parse(body) as { message?: string; error?: string; hint?: string };
      detail = payload.message ?? payload.error ?? payload.hint ?? body;
    } catch {
      // Keep the plain response text when Supabase did not return JSON.
    }
    throw new Error(`Supabase isteği başarısız (${response.status}): ${detail}`);
  }
  return (body ? JSON.parse(body) : undefined) as T;
}

// Read every page; PostgREST's row limit must not silently truncate a programme.
async function readAll<T>(path: string): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const page = await request<T[]>(`${path}&limit=${pageSize}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function getStudentAccount(filter: { id: string } | { email: string }) {
  const query = "id" in filter
    ? `id=eq.${encodeURIComponent(filter.id)}`
    : `email=eq.${encodeURIComponent(filter.email.trim().toLowerCase())}`;
  const rows = await request<SupabaseRow[]>(`students?${query}&select=*&limit=1`);
  const row = rows[0];
  if (!row) return null;
  const invites = await request<SupabaseInviteRow[]>(
    `invites?student_id=eq.${encodeURIComponent(String(row.id))}&select=*&limit=1`,
  );
  return {
    student: toStudent(row),
    archived: Boolean(row.archived_at),
    version: Number(row.session_version ?? 0),
    invite: invites[0] ?? null,
  };
}

export async function recordLoginEvent(event: {
  account_id?: string;
  email: string;
  role: string;
  outcome: string;
}) {
  // Observability must never turn a successful authentication into a failure.
  try {
    await request("login_events", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ ...event, source: process.env.OSLO_TEST_RUN === "1" ? "test" : "web" }),
    });
  } catch {
    console.error("Login audit could not be saved");
  }
}

export async function saveAttendanceBatchRpc(
  marks: SupabaseAttendanceRow[],
  actor: { id: string; role: string },
) {
  await request("rpc/save_attendance_batch", {
    method: "POST",
    body: JSON.stringify({ p_marks: marks, p_actor_id: actor.id, p_actor_role: actor.role }),
  });
}

export async function setStudentPasswordRpc(input: {
  studentId: string; passwordHash: string; inviteToken?: string; resetToken?: string;
}) {
  await request("rpc/set_student_password", {
    method: "POST",
    body: JSON.stringify({
      p_student_id: input.studentId,
      p_password: input.passwordHash,
      p_invite_token: input.inviteToken ?? null,
      p_reset_token: input.resetToken ?? null,
    }),
  });
}

export async function setSessionOutcomeRpc(sessionId: string, status: string, actor: { id: string; role: string }, reason = "") {
  await request("rpc/set_session_outcome", {
    method: "POST",
    body: JSON.stringify({
      p_session_id: sessionId, p_status: status,
      p_actor_id: actor.id, p_actor_role: actor.role, p_reason: reason,
    }),
  });
}

export async function resetStaffPasswordRpc(token: string, passwordHash: string) {
  await request("rpc/reset_staff_password", {
    method: "POST",
    body: JSON.stringify({ p_token: token, p_password_hash: passwordHash }),
  });
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
  await request("rpc/save_student_invite", {
    method: "POST",
    body: JSON.stringify({
      p_token: invite.token, p_student_id: invite.student_id,
      p_student: invite.student, p_sessions: invite.sessions,
      p_expires_at: invite.expires_at,
    }),
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

/** Single-row upsert for an instructor-created postpone record. */
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

/** Update one status for a validated group of sessions in one PostgREST
 * statement. The attendance API uses this for bulk approval/rejection so a
 * browser request cannot leave half the visible rows untouched. */
export async function patchSupabaseSessionStatuses(
  sessionIds: string[],
  status: string,
) {
  if (sessionIds.length === 0) return;
  const filter = sessionIds.map((id) => encodeURIComponent(id)).join(",");
  await request<unknown>(`sessions?id=in.(${filter})`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status }),
  });
}

/** Keep an existing attendance mark aligned with an instructor's manual result.
 * This intentionally updates only an existing mark; instructor-only changes
 * must not create a student attendance record.
 */
export async function patchSupabaseAttendanceStatus(
  sessionId: string,
  status: "attended" | "upcoming",
) {
  await request<unknown>(
    `attendance_marks?session_id=eq.${encodeURIComponent(sessionId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    },
  );
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
  await request("rpc/delete_student_bundle", {
    method: "POST", body: JSON.stringify({ p_student_id: studentId }),
  });
}

export async function readSupabaseStudent(studentId: string) {
  const rows = await request<SupabaseRow[]>(`students?id=eq.${encodeURIComponent(studentId)}&select=*&limit=1`);
  return rows[0] ? toStudent(rows[0]) : null;
}

export async function readSupabaseStudentSessions(studentId: string) {
  const rows = await readAll<SupabaseRow>(`sessions?student_id=eq.${encodeURIComponent(studentId)}&archived_at=is.null&select=*&order=session_date,id`);
  return rows.map(toSession);
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
  await saveSupabaseAttendanceBatch([mark]);
}

export async function saveSupabaseAttendanceBatch(marks: SupabaseAttendanceRow[]) {
  if (marks.length === 0) return;
  await request<SupabaseAttendanceRow[]>("attendance_marks?on_conflict=session_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(marks),
  });
}

export async function listSupabaseAttendance() {
  return readAll<SupabaseAttendanceRow>("attendance_marks?select=*&order=updated_at.desc,session_id");
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
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
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

export async function readSupabaseStudioData(): Promise<Pick<StudioState, "students" | "archivedStudents" | "sessions" | "postponeRequests" | "customGroups"> & { blockedEmails: string[] }> {
  const [studentRows, sessionRows, postponeRows, groupRows, blockedRows] = await Promise.all([
    readAll<SupabaseRow>("students?select=*&order=name,id"),
    // Archived sessions remain in Supabase for attendance history, but active
    // screens must only receive the current package-period sessions.
    readAll<SupabaseRow>("sessions?select=*&archived_at=is.null&order=session_date,id"),
    readAll<SupabaseRow>("postpone_requests?select=*&order=created_at.desc,id"),
    readAll<SupabaseRow>("custom_groups?select=*&order=label,id"),
    readAll<SupabaseRow>("blocked_emails?select=email&order=email"),
  ]);

  const allStudents = studentRows.map(toStudent);
  const archivedIds = new Set(
    studentRows.filter((row) => row.archived_at).map((row) => String(row.id)),
  );
  const activeStudents = allStudents.filter((student) => !archivedIds.has(student.id));
  const activeStudentById = new Map(activeStudents.map((student) => [student.id, student]));
  const activeSessions = sessionRows
    .map(toSession)
    .filter((session) => {
      const student = activeStudentById.get(session.studentId);
      if (!student) return false;
      const start = student.package.startDate;
      const end = student.package.endDate;
      return (!start || session.date >= start) && (!end || session.date <= end);
    });

  return {
    students: activeStudents,
    archivedStudents: allStudents.filter((student) => archivedIds.has(student.id)),
    // Old package rows stay in Supabase for history, but are not part of the
    // active application view. This keeps legacy sessions from leaking into a
    // newly selected package without destructively deleting data.
    sessions: activeSessions,
    postponeRequests: postponeRows
      .filter((row) => activeStudentById.has(String(row.student_id)) && activeSessions.some((session) => session.id === String(row.session_id)))
      .map((row) => ({
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

export async function saveSupabaseStudentBundle(input: {
  student: Student;
  sessions: Session[];
  customGroup?: ClassGroup;
  clearPostpones?: boolean;
}) {
  await request<unknown>("rpc/save_student_bundle", {
    method: "POST",
    body: JSON.stringify({
      p_student: studentRow(input.student, false),
      p_sessions: input.sessions.map((session) => ({
        id: session.id,
        student_id: session.studentId,
        group_id: session.groupId,
        session_date: session.date,
        status: session.status,
      })),
      p_custom_group: input.customGroup
        ? {
            id: input.customGroup.id,
            days: input.customGroup.days,
            time: input.customGroup.time,
            capacity: input.customGroup.capacity,
            label: input.customGroup.label,
          }
        : null,
      p_clear_postpones: input.clearPostpones ?? false,
      p_expected_updated_at: input.student.updatedAt ?? null,
    }),
  });
}

export async function patchSupabaseStudent(
  studentId: string,
  fields: Record<string, unknown>,
) {
  await request<unknown>(`students?id=eq.${encodeURIComponent(studentId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
}

export async function patchSupabaseStudentPackage(
  studentId: string,
  patch: Record<string, unknown>,
) {
  const result = await request<unknown>("rpc/patch_student_package", {
    method: "POST",
    body: JSON.stringify({ p_student_id: studentId, p_patch: patch }),
  });
  return result;
}

export async function patchSupabasePostponeReason(
  requestId: string,
  reason: string,
) {
  await request<unknown>(
    `postpone_requests?id=eq.${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ reason, updated_at: new Date().toISOString() }),
    },
  );
}

export async function patchSupabasePostponeStatus(
  requestId: string,
  status: "pending" | "approved" | "rejected",
) {
  await request<unknown>(
    `postpone_requests?id=eq.${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    },
  );
}

export type SupabasePasswordResetRow = {
  token: string;
  kind: "student" | "staff";
  account_id: string;
  email: string;
  expires_at: string;
  used_at?: string | null;
  created_at?: string;
};

export async function insertSupabasePasswordResetToken(
  row: Omit<SupabasePasswordResetRow, "used_at" | "created_at">,
) {
  await request<unknown>("password_reset_tokens", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify([row]),
  });
}

export async function getSupabasePasswordResetToken(token: string) {
  const rows = await request<SupabasePasswordResetRow[]>(
    `password_reset_tokens?token=eq.${encodeURIComponent(token)}&select=*&limit=1`,
  );
  return rows[0] ?? null;
}

export async function consumeSupabasePasswordResetToken(token: string) {
  await request<unknown>(
    `password_reset_tokens?token=eq.${encodeURIComponent(token)}`,
    {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ used_at: new Date().toISOString() }),
    },
  );
}
