import { getClassGroupById } from "@/data/groups";
import { todayISO } from "@/lib/dates";
import type { Session, SessionStatus, Student } from "@/types/studio";

export function remainingSessions(
  student: Student,
  sessions: Session[],
): number {
  const consumed = sessions.filter(
    (session) =>
      session.studentId === student.id &&
      (session.status === "attended" || session.status === "missed"),
  ).length;
  return Math.max(0, student.package.totalSessions - consumed);
}

export function lastAttendanceLabel(
  studentId: string,
  sessions: Session[],
): string {
  const attended = sessions
    .filter(
      (session) =>
        session.studentId === studentId && session.status === "attended",
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return attended[0]?.date ?? "";
}

export function sessionsForStudent(studentId: string, sessions: Session[]) {
  return sessions
    .filter((session) => session.studentId === studentId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupLabel(groupId: string) {
  return getClassGroupById(groupId)?.label ?? groupId;
}

export function studentName(studentId: string, students: Student[]) {
  return students.find((student) => student.id === studentId)?.name ?? studentId;
}

export function effectiveSessionStatus(session: Session): SessionStatus {
  if (session.status === "upcoming" && session.date < todayISO()) {
    return "missed";
  }
  return session.status;
}

export function sessionCounts(studentId: string, sessions: Session[]) {
  const mine = sessionsForStudent(studentId, sessions);
  return {
    attended: mine.filter((session) => effectiveSessionStatus(session) === "attended").length,
    postponed: mine.filter((session) => {
      const status = effectiveSessionStatus(session);
      return status === "postponed" || status === "postpone_pending";
    }).length,
    burned: mine.filter((session) => effectiveSessionStatus(session) === "missed").length,
  };
}
