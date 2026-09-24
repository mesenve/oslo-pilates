import { getClassGroupById } from "@/data/groups";
import { todayISO, weekdayFromISO } from "@/lib/dates";
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
  const consumed = sessionsForStudent(student.id, sessions, student).filter(
    (session) => session.status === "attended" || session.status === "missed",
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

export function sessionsForStudent(
  studentId: string,
  sessions: Session[],
  student?: Student,
) {
  // Session rows from earlier package periods remain in the database for
  // attendance history. Student-facing views and package counters must only
  // operate on the active package period.
  const startDate = student?.package.startDate;
  const endDate = student?.package.endDate;
  const hasPackagePeriod = Boolean(startDate && endDate && startDate <= endDate);
  return sessions
    .filter((session) => session.studentId === studentId)
    .filter((session) =>
      !hasPackagePeriod || (session.date >= startDate! && session.date <= endDate!),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function groupLabel(groupId: string) {
  return getClassGroupById(groupId)?.label ?? groupId;
}

export function studentName(studentId: string, students: Student[]) {
  return students.find((student) => student.id === studentId)?.name ?? studentId;
}

export function effectiveSessionStatus(session: Session): SessionStatus {
  // Gelecekteki bir ders henüz geldi ya da yandı olamaz. Eski hatalı
  // kayıtlarda bu durum görünürse takvim her zaman bekleyen ders olarak sunulur.
  if (
    session.date > todayISO() &&
    (session.status === "attended" || session.status === "missed")
  ) {
    return "upcoming";
  }
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

/** Date the postpone right was spent on (prefer session date). */
export function postponeRequestDate(
  request: PostponeRequest,
  sessions: Session[],
) {
  return sessions.find((item) => item.id === request.sessionId)?.date ?? null;
}

function isDateInPackage(student: Student, date: string) {
  const startDate = student.package?.startDate;
  const endDate = student.package?.endDate;
  if (!startDate || !endDate || startDate > endDate) return true;
  return date >= startDate && date <= endDate;
}

/** Distinct postponed sessions inside the active package period. */
export function postponeUsedInPackage(
  student: Student,
  requests: PostponeRequest[],
  sessions: Session[] = [],
) {
  const sessionIds = new Set<string>();
  for (const request of requests) {
    if (request.studentId !== student.id) continue;
    if (request.status === "rejected") continue;
    const date = postponeRequestDate(request, sessions);
    if (!date || !isDateInPackage(student, date)) continue;
    sessionIds.add(request.sessionId);
  }
  return sessionIds.size;
}

/** Most recent postpone-used date in the active package, if any. */
export function postponeUsedDateInPackage(
  student: Student,
  requests: PostponeRequest[],
  sessions: Session[] = [],
): string | null {
  const dates: string[] = [];
  for (const request of requests) {
    if (request.studentId !== student.id) continue;
    if (request.status === "rejected") continue;
    const date = postponeRequestDate(request, sessions);
    if (!date || !isDateInPackage(student, date)) continue;
    dates.push(date);
  }
  dates.sort((a, b) => b.localeCompare(a));
  if (dates[0]) return dates[0];
  if (!student.postponeLessonUsed) return null;
  const flagged = student.postponeLessonUsedAt?.slice(0, 10);
  if (flagged && !isDateInPackage(student, flagged)) return null;
  return flagged ?? null;
}

export function remainingPostponeRights(
  student: Student,
  requests: PostponeRequest[],
  sessions: Session[] = [],
) {
  const limit = Math.max(0, student.monthlyPostponeLimit ?? 1);
  const usedFromRequests = postponeUsedInPackage(student, requests, sessions);
  const usedFromFlag = student.postponeLessonUsed ? 1 : 0;
  return Math.max(0, limit - Math.max(usedFromRequests, usedFromFlag));
}

export function sessionCounts(
  studentId: string,
  sessions: Session[],
  student?: Student,
) {
  const mine = sessionsForStudent(studentId, sessions, student);
  return {
    attended: mine.filter((session) => effectiveSessionStatus(session) === "attended").length,
    postponed: mine.filter((session) => {
      const status = effectiveSessionStatus(session);
      return status === "postponed" || status === "postpone_pending";
    }).length,
    burned: mine.filter((session) => effectiveSessionStatus(session) === "missed").length,
  };
}
