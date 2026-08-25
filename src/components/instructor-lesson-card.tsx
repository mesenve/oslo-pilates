"use client";

import { ChevronRightIcon, ClockIcon } from "@/components/icons";
import { Card, SessionBadge } from "@/components/ui";
import { effectiveSessionStatus } from "@/data/accessors";
import { formatLongDate } from "@/lib/dates";
import type { InstructorLesson } from "@/lib/instructor-lessons";
import { lessonHref } from "@/lib/instructor-lessons";
import Link from "next/link";

export function InstructorLessonCard({ lesson }: { lesson: InstructorLesson }) {
  const pending = lesson.sessions.filter(
    (session) => effectiveSessionStatus(session) === "attend_pending",
  ).length;
  const waiting = lesson.sessions.filter(
    (session) => effectiveSessionStatus(session) === "upcoming",
  ).length;

  return (
    <Link href={lessonHref(lesson.date, lesson.groupId)} className="block">
      <Card className="flex items-center justify-between gap-4 px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(194,24,91,0.1)]">
        <div>
          <p className="font-serif text-xl capitalize">{formatLongDate(lesson.date)}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted">
            <ClockIcon className="h-4 w-4 text-accent" />
            {lesson.time} · {lesson.groupLabel}
          </p>
          <p className="mt-2 text-xs text-muted">
            {lesson.sessions.length} öğrenci
            {pending > 0 ? ` · ${pending} Geldim onayı` : ""}
            {waiting > 0 ? ` · ${waiting} bekleniyor` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pending > 0 ? <SessionBadge status="attend_pending" /> : null}
          <ChevronRightIcon className="h-5 w-5 text-muted" />
        </div>
      </Card>
    </Link>
  );
}
