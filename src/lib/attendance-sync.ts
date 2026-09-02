import type { Session, SessionStatus, StudioState } from "@/types/studio";
import type { StoredInvite } from "@/lib/server/invite-store";

export type AttendanceMark = {
  sessionId: string;
  studentId: string;
  date: string;
  groupId: string;
  status: "attend_pending" | "attended" | "upcoming";
  updatedAt?: string;
};

function attendanceRank(
  status: AttendanceMark["status"] | SessionStatus,
): number {
  switch (status) {
    case "upcoming":
      return 0;
    case "attend_pending":
    case "postpone_pending":
      return 1;
    case "attended":
    case "postponed":
    case "missed":
      return 2;
    default:
      return 0;
  }
}

function canApplyAttendanceMark(
  current: SessionStatus,
  next: AttendanceMark["status"],
) {
  if (next === "attend_pending") {
    return current === "upcoming" || current === "attend_pending";
  }
  if (next === "attended") {
    return (
      current === "upcoming" ||
      current === "attend_pending" ||
      current === "attended"
    );
  }
  if (next === "upcoming") {
    return current === "attend_pending" || current === "upcoming";
  }
  return false;
}

function shouldApplyMark(session: Session, mark: AttendanceMark) {
  if (!canApplyAttendanceMark(session.status, mark.status)) return false;
  if (attendanceRank(mark.status) < attendanceRank(session.status)) return false;
  return true;
}

export function mergeAttendanceMarks(
  sessions: Session[],
  marks: AttendanceMark[],
): Session[] {
  if (marks.length === 0) return sessions;

  const marksBySession = new Map<string, AttendanceMark>();
  for (const mark of marks) {
    const existing = marksBySession.get(mark.sessionId);
    if (!existing) {
      marksBySession.set(mark.sessionId, mark);
      continue;
    }
    const existingAt = existing.updatedAt ?? "";
    const nextAt = mark.updatedAt ?? "";
    if (nextAt >= existingAt) {
      marksBySession.set(mark.sessionId, mark);
    }
  }

  const next = sessions.map((session) => {
    const mark = marksBySession.get(session.id);
    if (!mark || !shouldApplyMark(session, mark)) {
      return session;
    }
    marksBySession.delete(session.id);
    return { ...session, status: mark.status as SessionStatus };
  });

  for (const mark of marksBySession.values()) {
    if (mark.status !== "attend_pending") continue;
    next.push({
      id: mark.sessionId,
      studentId: mark.studentId,
      date: mark.date,
      groupId: mark.groupId,
      status: mark.status,
    });
  }

  return next;
}

export function mergeActivatedInvites(
  state: StudioState,
  invites: Array<Pick<StoredInvite, "student" | "sessions">>,
): StudioState {
  let students = state.students;
  let sessions = state.sessions;
  const sessionIds = new Set(sessions.map((session) => session.id));

  for (const invite of invites) {
    const hasStudent = students.some((student) => student.id === invite.student.id);

    if (!hasStudent) {
      students = [invite.student, ...students];
      for (const session of invite.sessions) {
        if (sessionIds.has(session.id)) continue;
        sessions = [...sessions, session];
        sessionIds.add(session.id);
      }
      continue;
    }

    for (const session of invite.sessions) {
      if (sessionIds.has(session.id)) continue;
      sessions = [...sessions, session];
      sessionIds.add(session.id);
    }

    students = students.map((student) =>
      student.id === invite.student.id && student.accountStatus !== "active"
        ? invite.student
        : student,
    );
  }

  return { ...state, students, sessions };
}
