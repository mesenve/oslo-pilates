import { getClassGroupById } from "@/data/groups";
import { monthKey, todayISO, weekdayFromISO } from "@/lib/dates";
import { DAY_LABELS } from "@/lib/labels";
import type {
  PostponeRequest,
  Session,
  SessionStatus,
  Student,
} from "@/types/studio";

export type AttendanceBatch = {
  date: string;
  groupId: string;
  groupLabel: string;
  dayLabel: string;
  time: string;
  sessions: Session[];
};

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

export function pendingAttendanceBatches(
  sessions: Session[],
  activeStudentIds?: Set<string>,
): AttendanceBatch[] {
  const pending = sessions.filter((session) => {
    if (session.status !== "attend_pending") return false;
    if (!activeStudentIds) return true;
    return activeStudentIds.has(session.studentId);
  });
  const grouped = new Map<string, Session[]>();
  for (const session of pending) {
    const key = `${session.date}|${session.groupId}`;
    const list = grouped.get(key) ?? [];
    list.push(session);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .map(([key, list]) => {
      const [date, groupId] = key.split("|");
      const group = getClassGroupById(groupId);
      const day = weekdayFromISO(date);
      return {
        date,
        groupId,
        groupLabel: group?.label ?? groupId,
        dayLabel: day ? DAY_LABELS[day] : "",
        time: (day && group?.timeByDay?.[day]) || group?.time || "",
        sessions: list,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

export function postponeUsedThisMonth(
  studentId: string,
  requests: PostponeRequest[],
  month = monthKey(todayISO()),
) {
  return requests.filter(
    (request) =>
      request.studentId === studentId &&
      request.status !== "rejected" &&
      monthKey(request.createdAt) === month,
  ).length;
}

export function remainingPostponeRights(
  student: Student,
  requests: PostponeRequest[],
) {
  const limit = Math.max(0, student.monthlyPostponeLimit ?? 1);
  return Math.max(0, limit - postponeUsedThisMonth(student.id, requests));
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
