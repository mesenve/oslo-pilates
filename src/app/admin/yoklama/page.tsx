"use client";

import { AttendanceBoard } from "@/components/attendance-board";
import { pendingAttendanceBatches } from "@/data/accessors";
import { useStudio } from "@/components/studio-provider";

export default function AttendancePage() {
  const { visibleSessions, visibleStudents } = useStudio();
  const pending = pendingAttendanceBatches(
    visibleSessions,
    new Set(visibleStudents.map((student) => student.id)),
  ).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Onay</h1>
        {pending > 0 ? (
          <p className="mt-1 text-sm text-muted">{pending} grup onay bekliyor.</p>
        ) : null}
      </header>

      <AttendanceBoard />
    </div>
  );
}
