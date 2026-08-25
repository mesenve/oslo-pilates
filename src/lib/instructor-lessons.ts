import { getClassGroupById } from "@/data/groups";
import { weekdayFromISO } from "@/lib/dates";
import { DAY_LABELS } from "@/lib/labels";
import type { Session, Student } from "@/types/studio";

export type InstructorLesson = {
  key: string;
  date: string;
  groupId: string;
  groupLabel: string;
  time: string;
  dayLabel: string;
  sessions: Session[];
};

export function lessonKey(date: string, groupId: string) {
  return `${date}|${groupId}`;
}

export function parseLessonKey(key: string) {
  const [date, groupId] = key.split("|");
  return { date, groupId };
}

export function getInstructorLessons(
  sessions: Session[],
  students: Student[],
  fromDate: string,
  toDate: string,
): InstructorLesson[] {
  const studentIds = new Set(students.map((student) => student.id));
  const grouped = new Map<string, Session[]>();

  for (const session of sessions) {
    if (!studentIds.has(session.studentId)) continue;
    if (session.date < fromDate || session.date > toDate) continue;
    const key = lessonKey(session.date, session.groupId);
    const list = grouped.get(key) ?? [];
    list.push(session);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .map(([key, list]) => {
      const { date, groupId } = parseLessonKey(key);
      const group = getClassGroupById(groupId);
      const day = weekdayFromISO(date);
      return {
        key,
        date,
        groupId,
        groupLabel: group?.label ?? groupId,
        time: (day && group?.timeByDay?.[day]) || group?.time || "",
        dayLabel: day ? DAY_LABELS[day] : "",
        sessions: list.sort((a, b) =>
          studentName(a.studentId, students).localeCompare(
            studentName(b.studentId, students),
            "tr",
          ),
        ),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function studentName(studentId: string, students: Student[]) {
  return students.find((student) => student.id === studentId)?.name ?? studentId;
}

export function lessonHref(date: string, groupId: string) {
  return `/admin/ders/${date}/${groupId}`;
}
