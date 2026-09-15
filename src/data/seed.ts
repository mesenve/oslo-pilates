import { getClassGroupById } from "@/data/groups";
import { getStudents } from "@/data/students";
import {
  addDays,
  dateForWeekDay,
  parseISODate,
  startOfWeekMonday,
  toISODate,
  todayISO,
} from "@/lib/dates";
import { DEFAULT_STAFF_PASSWORDS } from "@/lib/staff-auth";
import { DEFAULT_STUDENT_PASSWORDS } from "@/lib/student-auth";
import type {
  ClassGroup,
  DayOfWeek,
  PostponeRequest,
  Session,
  Student,
  StudioState,
} from "@/types/studio";

const WEEK_COUNT = 4;

export function collectSessionDates(
  startDateISO: string,
  groupId: string,
  totalSessions: number,
  customDays?: DayOfWeek[],
): string[] {
  const group = getClassGroupById(groupId);
  const days = customDays?.length ? customDays : group?.days ?? [];
  if (days.length === 0) return [];

  const startMonday = startOfWeekMonday(parseISODate(startDateISO));
  const dates: string[] = [];
  for (let week = 0; dates.length < totalSessions && week < 52; week += 1) {
    const monday = addDays(startMonday, 7 * week);
    for (const day of days) {
      const iso = toISODate(dateForWeekDay(monday, day));
      if (iso < startDateISO) continue;
      dates.push(iso);
      if (dates.length >= totalSessions) break;
    }
  }
  return dates;
}

export function buildSessionsForStudent(
  student: Student,
  options?: { fromToday?: boolean; fromPackageStart?: boolean; group?: ClassGroup },
): Session[] {
  const group = options?.group ?? getClassGroupById(student.groupId);
  const days = student.package.customSchedule?.days?.length
    ? student.package.customSchedule.days
    : group?.days ?? [];
  if (days.length === 0) return [];

  const currentMonday = startOfWeekMonday();
  const today = todayISO();

  if (options?.fromPackageStart) {
    const dates = collectSessionDates(
      student.package.startDate,
      student.groupId,
      student.package.totalSessions,
      days,
    );
    return dates.map((date) => ({
      id: `${student.id}-${date}`,
      studentId: student.id,
      groupId: student.groupId,
      date,
      status: date < today ? ("attended" as const) : ("upcoming" as const),
    }));
  }

  if (options?.fromToday) {
    const dates: string[] = [];
    for (let week = 0; dates.length < student.package.totalSessions && week < 40; week += 1) {
      const monday = addDays(currentMonday, 7 * week);
      for (const day of days) {
        const iso = toISODate(dateForWeekDay(monday, day));
        if (iso < today) continue;
        dates.push(iso);
        if (dates.length >= student.package.totalSessions) break;
      }
    }
    return dates.map((date) => ({
      id: `${student.id}-${date}`,
      studentId: student.id,
      groupId: student.groupId,
      date,
      status: "upcoming" as const,
    }));
  }

  const dates: string[] = [];
  for (let week = WEEK_COUNT - 1; week >= 0; week -= 1) {
    const monday = addDays(currentMonday, -7 * week);
    for (const day of days) {
      dates.push(toISODate(dateForWeekDay(monday, day)));
    }
  }

  const packageDates = dates.slice(0, student.package.totalSessions);
  const attendedCount =
    student.package.totalSessions - student.package.remainingSessions;

  return packageDates.map((date, index) => ({
    id: `${student.id}-${date}`,
    studentId: student.id,
    groupId: student.groupId,
    date,
    status: index < attendedCount ? "attended" : "upcoming",
  }));
}

export function createSeedState(): StudioState {
  const students = getStudents();
  const sessions = students.flatMap((student) => buildSessionsForStudent(student));
  const postponeRequests: PostponeRequest[] = [];
  const currentMondayISO = toISODate(startOfWeekMonday());
  const elifUpcoming =
    sessions.find(
      (session) =>
        session.studentId === "stu-elif" &&
        session.status === "upcoming" &&
        toISODate(startOfWeekMonday(parseISODate(session.date))) ===
          currentMondayISO,
    ) ??
    sessions.find(
      (session) =>
        session.studentId === "stu-elif" && session.status === "upcoming",
    );

  if (elifUpcoming) {
    elifUpcoming.status = "postpone_pending";
    postponeRequests.push({
      id: `req-${elifUpcoming.id}`,
      studentId: elifUpcoming.studentId,
      sessionId: elifUpcoming.id,
      reason: "İş seyahati nedeniyle bu dersi ertelemek istiyorum.",
      status: "pending",
      createdAt: `${todayISO()}T09:00:00`,
    });
  }

  const denizUpcoming = sessions.find(
    (session) =>
      session.studentId === "stu-deniz" &&
      session.status === "upcoming" &&
      session.date >= todayISO(),
  );
  if (denizUpcoming) {
    denizUpcoming.status = "postponed";
    postponeRequests.push({
      id: `req-${denizUpcoming.id}`,
      studentId: denizUpcoming.studentId,
      sessionId: denizUpcoming.id,
      reason: "Akşam saati uygun değil.",
      status: "approved",
      createdAt: `${todayISO()}T08:00:00`,
    });
  }

  const merveUpcoming = sessions.find(
    (session) =>
      session.studentId === "stu-merve" &&
      session.status === "upcoming" &&
      session.date >= todayISO(),
  );
  if (merveUpcoming) {
    merveUpcoming.status = "postpone_pending";
    postponeRequests.push({
      id: `req-${merveUpcoming.id}`,
      studentId: merveUpcoming.studentId,
      sessionId: merveUpcoming.id,
      reason: "Son hafta, bu dersi ertelemek istiyorum.",
      status: "pending",
      createdAt: `${todayISO()}T10:00:00`,
    });
  }

  function markAttendPending(studentId: string) {
    const session = sessions.find(
      (item) =>
        item.studentId === studentId &&
        item.status === "upcoming" &&
        item.date >= todayISO(),
    );
    if (session) session.status = "attend_pending";
  }

  markAttendPending("stu-ayse");
  markAttendPending("stu-deniz");

  return {
    user: null,
    students,
    archivedStudents: [],
    sessions,
    postponeRequests,
    customGroups: [],
    staffPasswords: { ...DEFAULT_STAFF_PASSWORDS },
    studentPasswords: { ...DEFAULT_STUDENT_PASSWORDS },
  };
}
