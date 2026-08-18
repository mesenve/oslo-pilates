"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { Card } from "@/components/ui";
import { monthGrid, monthTitle, todayISO } from "@/lib/dates";
import { CALENDAR_HEADERS } from "@/lib/labels";
import type { SessionStatus } from "@/types/studio";
import { useMemo, useState } from "react";

export type CalendarMark = {
  date: string;
  status?: SessionStatus;
  count?: number;
};

export function ClassCalendar({
  marks,
  selectedDate,
  onSelectDate,
}: {
  marks: CalendarMark[];
  selectedDate: string | null;
  onSelectDate: (iso: string) => void;
}) {
  const today = todayISO();
  const initial = selectedDate ?? marks[0]?.date ?? today;
  const start = new Date(`${initial.slice(0, 7)}-01T12:00:00`);
  const [cursor, setCursor] = useState({
    year: start.getFullYear(),
    month: start.getMonth(),
  });

  const markMap = useMemo(() => {
    const map = new Map<string, CalendarMark>();
    for (const mark of marks) map.set(mark.date, mark);
    return map;
  }, [marks]);

  const cells = monthGrid(cursor.year, cursor.month);

  function shift(delta: number) {
    setCursor((current) => {
      const date = new Date(current.year, current.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="rounded-full p-2 text-accent hover:bg-accent-soft"
          aria-label="Önceki ay"
        >
          <ChevronLeftIcon />
        </button>
        <p className="font-serif text-lg capitalize">
          {monthTitle(cursor.year, cursor.month)}
        </p>
        <button
          type="button"
          onClick={() => shift(1)}
          className="rounded-full p-2 text-accent hover:bg-accent-soft"
          aria-label="Sonraki ay"
        >
          <ChevronRightIcon />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
        {CALENDAR_HEADERS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((iso, index) => {
          if (!iso) return <div key={`empty-${index}`} className="h-10" />;
          const mark = markMap.get(iso);
          const selected = selectedDate === iso;
          const isToday = iso === today;
          const day = Number(iso.slice(8));
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              className={`relative flex h-10 items-center justify-center rounded-2xl text-sm ${
                selected
                  ? "bg-gradient-to-br from-[#f06292] to-accent text-white shadow-md"
                  : isToday
                    ? "bg-accent-soft text-accent"
                    : mark
                      ? "bg-white/80 text-foreground"
                      : "text-muted"
              }`}
            >
              {day}
              {mark && !selected ? (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${dotClass(mark)}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function dotClass(mark: CalendarMark) {
  if (mark.status === "attended") return "bg-emerald-500";
  if (mark.status === "attend_pending" || mark.status === "postpone_pending") {
    return "bg-amber-500";
  }
  if (mark.status === "postponed" || mark.status === "missed") return "bg-rose-400";
  if ((mark.count ?? 0) > 0 || mark.status === "upcoming") return "bg-accent";
  return "bg-accent";
}
