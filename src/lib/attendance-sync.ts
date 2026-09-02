import type { Session, SessionStatus, StudioState, Student } from "@/types/studio";
import type { StoredInvite } from "@/lib/server/invite-store";

export type AttendanceMark = {
  sessionId: string;
  studentId: string;
  date: string;
  groupId: string;
  status: "attend_pending" | "attended" | "upcoming";
  updatedAt?: string;
};

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

export function mergeAttendanceMarks(
  sessions: Session[],
  marks: AttendanceMark[],
): Session[] {
  if (marks.length === 0) return sessions;

  const next = sessions.map((session) => {
    const mark = marks.find((item) => item.sessionId === session.id);
    if (!mark || !canApplyAttendanceMark(session.status, mark.status)) {
      return session;
    }
    return { ...session, status: mark.status as SessionStatus };
  });

  const knownIds = new Set(next.map((session) => session.id));
  for (const mark of marks) {
    if (knownIds.has(mark.sessionId) || mark.status !== "attend_pending") continue;
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

  for (const invite of invites) {
    const hasStudent = students.some((student) => student.id === invite.student.id);
    if (!hasStudent) {
      students = [invite.student, ...students];
      sessions = [
        ...sessions.filter((session) => session.studentId !== invite.student.id),
        ...invite.sessions,
      ];
      continue;
    }

    sessions = [
      ...sessions.filter((session) => session.studentId !== invite.student.id),
      ...invite.sessions,
    ];
    students = students.map((student) =>
      student.id === invite.student.id ? invite.student : student,
    );
  }

  return { ...state, students, sessions };
}
