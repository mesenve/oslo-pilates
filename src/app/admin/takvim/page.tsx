"use client";

import { ClassCalendar } from "@/components/class-calendar";
import { GroupClassCard } from "@/components/group-class-card";
import { EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { getClassGroups, getClassGroupsForDay } from "@/data/groups";
import { DAY_LABELS } from "@/lib/labels";
import {
  addDays,
  startOfWeekMonday,
  toISODate,
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
  const displayedGroups = onlyFullGroups
    ? groups.filter(
        (group) =>
          group.capacity > 0 &&
          visibleStudents.filter((student) => student.groupId === group.id).length >= group.capacity,
      )
    : groups;
  const specialProgramSessions = visibleSessions.filter(
    (session) => session.date === selectedDate && session.groupId === "duzensiz",
  );

  const marks = useMemo(() => {
    const allGroups = getClassGroups();
    const origin = startOfWeekMonday();
    const result: { date: string; count: number }[] = [];
    for (let i = -35; i < 56; i += 1) {
      const iso = toISODate(addDays(origin, i));
      const weekday = weekdayFromISO(iso);
      if (!weekday) continue;
      const count = allGroups.filter((group) => group.days.includes(weekday)).length;
      if (count) result.push({ date: iso, count });
    }
    return result;
  }, [customGroups]);

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
          Sadece dolu gruplar
        </label>
      </div>
      {todayDay && selectedDate === today ? (
        <p className="text-xs text-muted">Bugünün programı</p>
      ) : null}

      {displayedGroups.length === 0 && (!specialProgramSessions.length || onlyFullGroups) ? (
        <EmptyState>
          {onlyFullGroups ? "Bu günde dolu grup yok." : "Bu günde grup dersi yok."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedGroups.map((group) => (
            <GroupClassCard
              key={group.id}
              group={group}
              day={day}
              students={visibleStudents}
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
