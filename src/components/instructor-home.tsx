"use client";

import { ClassCalendar } from "@/components/class-calendar";
import { InstructorLessonCard } from "@/components/instructor-lesson-card";
import { EmptyState } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import {
  addDays,
  formatWeekRange,
  startOfWeekMonday,
  toISODate,
  todayISO,
} from "@/lib/dates";
import { getInstructorLessons } from "@/lib/instructor-lessons";
import Link from "next/link";
import { useMemo, useState } from "react";

type Tab = "today" | "week" | "calendar";

export function InstructorHome({ userName }: { userName: string }) {
  const { visibleStudents, visibleSessions } = useStudio();
  const today = todayISO();
  const monday = startOfWeekMonday();
  const weekStart = toISODate(monday);
  const friday = toISODate(addDays(monday, 4));
  const [tab, setTab] = useState<Tab>("today");
  const [selectedDate, setSelectedDate] = useState(today);

  const todayLessons = useMemo(
    () => getInstructorLessons(visibleSessions, visibleStudents, today, today),
    [today, visibleSessions, visibleStudents],
  );

  const weekLessons = useMemo(
    () => getInstructorLessons(visibleSessions, visibleStudents, weekStart, friday),
    [friday, weekStart, visibleSessions, visibleStudents],
  );

  const calendarLessons = useMemo(
    () => getInstructorLessons(visibleSessions, visibleStudents, weekStart, friday),
    [friday, weekStart, visibleSessions, visibleStudents],
  );

  const marks = useMemo(
    () =>
      calendarLessons.map((lesson) => ({
        date: lesson.date,
        status: "upcoming" as const,
      })),
    [calendarLessons],
  );

  const selectedLessons = calendarLessons.filter(
    (lesson) => lesson.date === selectedDate,
  );

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Eğitmen
        </p>
        <h1 className="mt-1 font-serif text-3xl">Bugünkü derslerim</h1>
        <p className="mt-1 text-sm text-muted">{userName}</p>
      </header>

      <div className="grid grid-cols-3 gap-2 rounded-full bg-surface-muted p-1">
        <TabButton active={tab === "today"} onClick={() => setTab("today")}>
          Bugün
        </TabButton>
        <TabButton active={tab === "week"} onClick={() => setTab("week")}>
          Bu hafta
        </TabButton>
        <TabButton active={tab === "calendar"} onClick={() => setTab("calendar")}>
          Takvimim
        </TabButton>
      </div>

      {tab === "today" ? (
        <LessonList empty="Bugün dersin yok." lessons={todayLessons} />
      ) : null}

      {tab === "week" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">{formatWeekRange(monday)}</p>
          <LessonList empty="Bu hafta dersin yok." lessons={weekLessons} />
        </div>
      ) : null}

      {tab === "calendar" ? (
        <div className="space-y-4">
          <ClassCalendar
            marks={marks}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-serif text-xl capitalize">
              {selectedDate === today ? "Bugün" : selectedDate}
            </h2>
            <Link href="/admin/takvim" className="text-sm font-medium text-accent">
              Tam takvim →
            </Link>
          </div>
          <LessonList empty="Bu günde dersin yok." lessons={selectedLessons} />
        </div>
      ) : null}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-sm ${
        active ? "bg-white text-accent shadow-sm" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function LessonList({
  lessons,
  empty,
}: {
  lessons: ReturnType<typeof getInstructorLessons>;
  empty: string;
}) {
  if (lessons.length === 0) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-3">
      {lessons.map((lesson) => (
        <InstructorLessonCard key={lesson.key} lesson={lesson} />
      ))}
    </div>
  );
}
