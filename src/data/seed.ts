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
import type { PostponeRequest, Session, Student, StudioState } from "@/types/studio";

const WEEK_COUNT = 4;

export function buildSessionsForStudent(student: Student): Session[] {
  const group = getClassGroupById(student.groupId);
  if (!group) return [];

  const currentMonday = startOfWeekMonday();
  const dates: string[] = [];
  for (let week = WEEK_COUNT - 1; week >= 0; week -= 1) {
    const monday = addDays(currentMonday, -7 * week);
    for (const day of group.days) {
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
  const sessions = students.flatMap(buildSessionsForStudent);
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

  const mondayCheckIn = sessions.find(
    (session) =>
      session.groupId === "pzt-car-cum-1000" &&
      session.status === "upcoming" &&
      session.date >= todayISO() &&
      session.studentId !== "stu-merve",
  );
  if (mondayCheckIn) {
    for (const session of sessions) {
      if (
        session.groupId === mondayCheckIn.groupId &&
        session.date === mondayCheckIn.date &&
        session.status === "upcoming" &&
        session.studentId !== "stu-merve"
      ) {
        session.status = "attend_pending";
      }
    }
  }

  return {
    user: null,
    students,
    archivedStudents: [],
    sessions,
    postponeRequests,
  };
}
