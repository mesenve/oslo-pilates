"use client";

import { AttendanceBoard, pendingAttendanceCount } from "@/components/attendance-board";
import { pendingAttendanceBatches } from "@/data/accessors";
import { useStudio } from "@/components/studio-provider";

export default function AttendancePage() {
  const { visibleSessions, visibleStudents } = useStudio();
  const activeIds = new Set(visibleStudents.map((student) => student.id));
  const pendingPeople = pendingAttendanceCount(visibleSessions, activeIds);
  const pendingGroups = pendingAttendanceBatches(visibleSessions, activeIds).length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-serif text-3xl">Onay</h1>
        {pendingPeople > 0 ? (
          <p className="mt-1 text-sm text-muted">
            {pendingPeople} kişi onay bekliyor
            {pendingGroups > 1 ? ` · ${pendingGroups} grup` : ""}.
          </p>
        ) : null}
      </header>

      <AttendanceBoard />
    </div>
  );
}
