"use client";

import { Button, Card, EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { groupLabel, pendingAttendanceBatches, studentName } from "@/data/accessors";
import { formatLongDate } from "@/lib/dates";

export function AttendanceBoard() {
  const { visibleSessions, visibleStudents, approveAttendance, rejectAttendance } =
    useStudio();
  const activeIds = new Set(visibleStudents.map((student) => student.id));
  const batches = pendingAttendanceBatches(visibleSessions, activeIds);

  if (batches.length === 0) {
    return <EmptyState>Bekleyen yoklama onayı yok.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const batchIds = batch.sessions.map((session) => session.id);
        return (
          <Card key={`${batch.date}-${batch.groupId}`} className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="font-serif text-2xl">{batch.dayLabel} grubu</p>
                <p className="mt-1 text-sm text-muted">
                  {formatLongDate(batch.date)}
                  {batch.time ? ` · ${batch.time}` : ""} · {batch.groupLabel}
                </p>
              </div>
              {batch.sessions.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => approveAttendance(batchIds)}>
                    Tümünü onayla
                  </Button>
                  <Button variant="ghost" onClick={() => rejectAttendance(batchIds)}>
                    Tümünü geri al
                  </Button>
                </div>
              ) : null}
            </div>

            <ul className="mt-4 space-y-2">
              {batch.sessions.map((session) => {
                const student = visibleStudents.find(
                  (item) => item.id === session.studentId,
                );
                const isGuest = student ? student.groupId !== batch.groupId : false;

                return (
                  <li
                    key={session.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">
                        {studentName(session.studentId, visibleStudents)}
                      </p>
                      {isGuest ? (
                        <p className="mt-1 text-xs text-muted">
                          Farklı gruptan · {groupLabel(student?.groupId ?? "")}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => approveAttendance([session.id])}>
                        Onayla
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => rejectAttendance([session.id])}
                      >
                        Geri al
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

export function pendingAttendanceCount(
  sessions: Parameters<typeof pendingAttendanceBatches>[0],
  activeStudentIds: Set<string>,
) {
  return sessions.filter(
    (session) =>
      session.status === "attend_pending" && activeStudentIds.has(session.studentId),
  ).length;
}
