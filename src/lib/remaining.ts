/**
 * Lessons still owed on the package.
 * Past unmarked rows are not shown as "Yandı" to the student, but they also
 * must not inflate "X ders kaldı" — the studio handles those offline.
 */
export function countRemainingSessions(
  totalSessions: number,
  sessions: Array<{ date: string; status: string }>,
  today: string,
) {
  const consumed = sessions.filter((session) => {
    if (session.status === "attended" || session.status === "missed") return true;
    if (
      session.date < today &&
      (session.status === "upcoming" ||
        session.status === "postpone_pending" ||
        session.status === "attend_pending")
    ) {
      return true;
    }
    return false;
  }).length;
  return Math.max(0, totalSessions - consumed);
}
