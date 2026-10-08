import { todayISO } from "@/lib/dates";
import { countRemainingSessions } from "@/lib/remaining";
import { patchSupabaseStudentPackage } from "@/lib/server/supabase-rest";

/** Recompute denormalized package.remainingSessions from canonical session rows. */
export async function syncRemainingSessions(
  student: {
    id: string;
    package?: { totalSessions?: number; startDate?: string; endDate?: string };
  },
  sessions: Array<{ id: string; studentId: string; date: string; status: string }>,
  overrides: Array<{ sessionId: string; status: string }> = [],
) {
  const totalSessions = Number(student.package?.totalSessions);
  const startDate = student.package?.startDate;
  const endDate = student.package?.endDate;
  if (!Number.isFinite(totalSessions) || !startDate || !endDate) return;

  const overrideById = new Map(overrides.map((item) => [item.sessionId, item.status]));
  const inPeriod = sessions
    .filter(
      (item) =>
        item.studentId === student.id &&
        item.date >= startDate &&
        item.date <= endDate,
    )
    .map((item) => ({
      date: item.date,
      status: overrideById.get(item.id) ?? item.status,
    }));

  await patchSupabaseStudentPackage(student.id, {
    remainingSessions: countRemainingSessions(totalSessions, inPeriod, todayISO()),
  });
}
