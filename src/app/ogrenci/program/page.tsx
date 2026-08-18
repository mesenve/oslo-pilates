"use client";

import { ClassCalendar } from "@/components/class-calendar";
import { SessionRow } from "@/components/session-row";
import { useCurrentStudent, useStudio } from "@/components/studio-provider";
import { EmptyState } from "@/components/ui";
import { sessionsForStudent } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { todayISO } from "@/lib/dates";
import { useMemo, useState } from "react";

export default function ProgramPage() {
  const student = useCurrentStudent();
  const { sessions, markAttended, requestPostpone } = useStudio();
  const mine = sessionsForStudent(student?.id ?? "", sessions);
  const today = todayISO();
  const defaultDate =
    mine.find((session) => session.date >= today)?.date ??
    mine.at(-1)?.date ??
    today;
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const marks = useMemo(
    () => mine.map((session) => ({ date: session.date, status: session.status })),
    [mine],
  );
  const selected = mine.filter((session) => session.date === selectedDate);
  const group = student ? getClassGroupById(student.groupId) : undefined;

  if (!student) return null;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Ders takvimi
        </p>
        <h1 className="mt-1 font-serif text-3xl">Programın</h1>
        <p className="mt-1 text-sm text-muted">{group?.label}</p>
      </header>

      <ClassCalendar
        marks={marks}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <Legend color="bg-accent" label="Ders günü" />
        <Legend color="bg-emerald-500" label="Geldi" />
        <Legend color="bg-amber-500" label="Erteleme" />
      </div>

      {selected.length === 0 ? (
        <EmptyState>Bu günde dersin yok.</EmptyState>
      ) : (
        selected.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            time={group?.time ?? ""}
            onAttend={() => markAttended(session.id)}
            onPostpone={(reason) => requestPostpone(session.id, reason)}
          />
        ))
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
