"use client";

import { ClassCalendar } from "@/components/class-calendar";
import { SessionRow } from "@/components/session-row";
import { useCurrentStudent, useStudio } from "@/components/studio-provider";
import { EmptyState } from "@/components/ui";
import { sessionsForStudent } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { isAtLeast24HoursAway, todayISO, weekdayFromISO } from "@/lib/dates";
import { postponeRightLabel } from "@/lib/labels";
import { type ComponentProps, useEffect, useMemo, useState } from "react";

export default function ProgramPage() {
  const student = useCurrentStudent();
  const { sessions, markAttended, requestPostpone, withdrawPostpone, remainingPostponeFor } =
    useStudio();
  const mine = sessionsForStudent(student?.id ?? "", sessions);
  const today = todayISO();
  const defaultDate =
    mine.find((session) => session.date >= today)?.date ??
    mine.at(-1)?.date ??
    today;
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  useEffect(() => {
    const requestedDate = new URLSearchParams(window.location.search).get("date");
    if (requestedDate && mine.some((session) => session.date === requestedDate)) {
      setSelectedDate(requestedDate);
    }
  }, [mine]);
  const marks = useMemo(
    () => mine.map((session) => ({ date: session.date, status: session.status })),
    [mine],
  );
  const selected = mine.filter((session) => session.date === selectedDate);
  const group = student ? getClassGroupById(student.groupId) : undefined;
  const postponeRemaining = student ? remainingPostponeFor(student.id) : 0;
  const postponeHint = student
    ? postponeRightLabel(postponeRemaining, student.monthlyPostponeLimit > 0 ? 1 : 0)
    : "";

  if (!student) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl">Programın</h1>
        <p className="mt-1 text-sm text-muted">{group?.label}</p>
        <p className="mt-1 text-sm text-muted">{postponeHint}</p>
      </header>

      <ClassCalendar
        marks={marks}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="flex flex-wrap gap-3 text-[11px] text-muted">
        <Legend color="bg-accent" label="Ders günü" />
        <Legend color="bg-emerald-500" label="Geldi" />
        <Legend color="bg-amber-500" label="Geldim onayı" />
        <Legend color="bg-rose-400" label="Erteleme" />
      </div>

      {selected.length === 0 ? (
        <EmptyState>Bu günde dersin yok.</EmptyState>
      ) : (
        selected.map((session) => (
          <ProgramSessionRow
            key={session.id}
            session={session}
            time={group?.time ?? ""}
            canPostpone={postponeRemaining > 0 && session.date > today}
            canAttend={session.date === today}
            postponeHint={postponeHint}
            onAttend={() => markAttended(session.id)}
            onPostpone={(reason) => requestPostpone(session.id, reason)}
            onWithdrawPostpone={() => void withdrawPostpone(session.id)}
          />
        ))
      )}
    </div>
  );
}

function ProgramSessionRow({
  session,
  time,
  canPostpone,
  canAttend,
  postponeHint,
  onAttend,
  onPostpone,
}: ComponentProps<typeof SessionRow>) {
  const group = getClassGroupById(session.groupId);
  const day = weekdayFromISO(session.date);
  const sessionTime = (day && group?.timeByDay?.[day]) ?? group?.time ?? time;
  const canPostponeAtThisTime = canPostpone && isAtLeast24HoursAway(session.date, sessionTime);
  const hint = canPostponeAtThisTime
    ? postponeHint
    : canPostpone
      ? "Ders başlangıcına 24 saatten az kaldığı için ertelenemez."
      : postponeHint;

  return (
    <SessionRow
      session={session}
      time={sessionTime}
      canPostpone={canPostponeAtThisTime}
      canAttend={canAttend}
      postponeHint={hint}
      onAttend={onAttend}
      onPostpone={onPostpone}
    />
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
