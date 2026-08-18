"use client";

import { AttendanceBoard } from "@/components/attendance-board";
import { pendingAttendanceBatches } from "@/data/accessors";
import { useStudio } from "@/components/studio-provider";

export default function AttendancePage() {
  const { sessions } = useStudio();
  const pending = pendingAttendanceBatches(sessions).length;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Yoklama
        </p>
        <h1 className="mt-1 font-serif text-3xl">Onay</h1>
        <p className="mt-1 text-sm text-muted">
          Öğrenci Geldim deyince grup burada bekler. {pending} grup onay bekliyor.
        </p>
      </header>

      <AttendanceBoard />
    </div>
  );
}
