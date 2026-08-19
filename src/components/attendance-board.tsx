"use client";

import { Button, Card, EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { pendingAttendanceBatches, studentName } from "@/data/accessors";
import { formatLongDate } from "@/lib/dates";

export function AttendanceBoard() {
  const { sessions, students, approveAttendance, rejectAttendance } = useStudio();
  const batches = pendingAttendanceBatches(
    sessions,
    new Set(students.map((student) => student.id)),
  );

  if (batches.length === 0) {
    return <EmptyState>Bekleyen yoklama onayı yok.</EmptyState>;
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const ids = batch.sessions.map((session) => session.id);
        return (
          <Card key={`${batch.date}-${batch.groupId}`} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-serif text-2xl">
                  {batch.dayLabel} grubu
                </p>
                <p className="mt-1 text-sm text-muted">
                  {formatLongDate(batch.date)}
                  {batch.time ? ` · ${batch.time}` : ""} · {batch.groupLabel}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {batch.sessions.map((session) => (
                    <li key={session.id}>
                      {studentName(session.studentId, students)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => approveAttendance(ids)}>
                  {batch.dayLabel} grubunu onayla
                </Button>
                <Button variant="ghost" onClick={() => rejectAttendance(ids)}>
                  Geri al
                </Button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
