"use client";

import { ClassCalendar } from "@/components/class-calendar";
import { GroupClassCard } from "@/components/group-class-card";
import { EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { getClassGroupsForDay } from "@/data/groups";
import { DAY_LABELS } from "@/lib/labels";
import {
  todayISO,
  weekdayFromISO,
} from "@/lib/dates";
import { useMemo, useState } from "react";

export default function CalendarPage() {
  const { visibleStudents, visibleSessions, customGroups } = useStudio();
  const today = todayISO();
  const todayDay = weekdayFromISO(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [onlyFullGroups, setOnlyFullGroups] = useState(false);
  const day = weekdayFromISO(selectedDate);
  const groups = day ? getClassGroupsForDay(day) : [];
  const groupsWithSessions = groups.filter((group) =>
    visibleSessions.some(
      (session) => session.date === selectedDate && session.groupId === group.id,
    ),
  );
  const displayedGroups = onlyFullGroups
    ? groupsWithSessions.filter((group) =>
        visibleStudents.some(
          (student) =>
            student.groupId === group.id &&
            visibleSessions.some(
              (session) =>
                session.date === selectedDate &&
                session.groupId === group.id &&
                session.studentId === student.id,
            ),
        ),
      )
    : groupsWithSessions;
  const specialProgramSessions = visibleSessions.filter(
    (session) => session.date === selectedDate && session.groupId === "duzensiz",
  );

  const marks = useMemo(() => {
    const counts = new Map<string, number>();
    for (const session of visibleSessions) {
      counts.set(session.date, (counts.get(session.date) ?? 0) + 1);
    }
    return [...counts.entries()].map(([date, count]) => ({ date, count }));
  }, [visibleSessions, customGroups]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-3xl">Takvim</h1>
      </header>

      <ClassCalendar
        marks={marks}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">
          {day ? `${DAY_LABELS[day]} grupları` : "Hafta sonu"}
        </h2>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={onlyFullGroups}
            onChange={(event) => setOnlyFullGroups(event.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          Sadece kayıtlı gruplar
        </label>
      </div>
      {todayDay && selectedDate === today ? (
        <p className="text-xs text-muted">Bugünün programı</p>
      ) : null}

      {displayedGroups.length === 0 && (!specialProgramSessions.length || onlyFullGroups) ? (
        <EmptyState>
          {onlyFullGroups ? "Bu günde kayıtlı öğrenci olan grup yok." : "Bu günde planlanmış grup dersi yok."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedGroups.map((group) => (
            <GroupClassCard
              key={group.id}
              group={group}
              day={day}
              date={selectedDate}
              students={visibleStudents}
              sessions={visibleSessions}
            />
            ))}
          {specialProgramSessions.length > 0 && !onlyFullGroups ? (
            <a
              href={`/admin/ders/${selectedDate}/duzensiz`}
              className="rounded-2xl border border-border bg-white p-4 transition-colors hover:bg-surface-muted"
            >
              <p className="font-serif text-2xl">Özel program</p>
              <p className="mt-1 text-sm text-muted">
                {specialProgramSessions.length} öğrenci · Gün ve saatleri farklı
              </p>
            </a>
          ) : null}
        </div>
      )}
    </div>
  );
}
