import type { Session, SessionStatus } from "@/types/studio";

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

  // Attendance marks are an overlay on the canonical sessions list.  Never
  // materialize a mark without a matching session: old package/session marks
  // can legitimately remain in the database as history, but they must not
  // resurrect an old lesson in the active student or instructor screens.
  return next;
}
