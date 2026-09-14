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
  const day = weekdayFromISO(selectedDate);
  const groups = day ? getClassGroupsForDay(day) : [];
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

      <h2 className="font-serif text-xl">
        {day ? `${DAY_LABELS[day]} grupları` : "Hafta sonu"}
      </h2>
      {todayDay && selectedDate === today ? (
        <p className="text-xs text-muted">Bugünün programı</p>
      ) : null}

      {groups.length === 0 && specialProgramSessions.length === 0 ? (
        <EmptyState>Bu günde grup dersi yok.</EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <GroupClassCard
              key={group.id}
              group={group}
              day={day}
              students={visibleStudents}
            />
            ))}
          {specialProgramSessions.length > 0 ? (
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
