"use client";

import { ChevronRightIcon, PilatesIcon, SeatIcon, UsersIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import { sortByName } from "@/lib/alphabet";
import { DAY_LABELS } from "@/lib/labels";
import type { ClassGroup, DayOfWeek, Student } from "@/types/studio";
import Link from "next/link";
import { useState } from "react";

export function GroupClassCard({
  group,
  day,
  students,
}: {
  group: ClassGroup;
  day: DayOfWeek | null;
  students: Student[];
}) {
  const [open, setOpen] = useState(false);
  const members = sortByName(students.filter((student) => student.groupId === group.id));
  const time = displayGroupTime(group, day);
  const daysLabel = group.days.map((item) => DAY_LABELS[item]).join(" · ");
  const spotsLeft = Math.max(0, group.capacity - members.length);
  const isFull = spotsLeft === 0;
  const showSpots = members.length > 0;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-[0_12px_28px_rgba(194,24,91,0.1)]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-white/40"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft">
          <PilatesIcon className="h-8 w-8" />
        </div>

        <div className="min-w-0 flex-1 border-l border-border/60 pl-4">
          <p className="font-serif text-2xl leading-none tracking-tight">{time}</p>
          <p className="mt-1 text-sm text-muted">{daysLabel}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent/75">
              <UsersIcon className="h-3.5 w-3.5" />
              {members.length} kayıtlı
            </span>
            {showSpots ? (
              isFull ? (
                <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-white">
                  Dolu
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
                  <SeatIcon className="h-3.5 w-3.5" />
                  {spotsLeft} boş yer
                </span>
              )
            ) : null}
          </div>
        </div>

        <ChevronRightIcon
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="border-t border-border/70 bg-surface-muted/25 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-muted">
            {group.label}
          </p>
          {members.length === 0 ? (
            <p className="text-sm text-muted">Bu grupta kayıtlı öğrenci yok.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/admin/ogrenciler/${student.id}`}
                    className="block rounded-xl px-2 py-1.5 text-sm hover:bg-white/80"
                  >
                    {student.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function displayGroupTime(group: ClassGroup, day: DayOfWeek | null) {
  const perDayTime = day && group.timeByDay?.[day];
  if (perDayTime) return perDayTime;

  // Eski programlarda saat alanı "Pazartesi 12.00 / Salı 13.00" gibi
  // kaydedilmiş olabilir. Kart başlığında gün adlarını değil, yalnızca
  // saatleri gösteririz; günler alt satırda zaten yer alıyor.
  const times = group.time.match(/\b\d{1,2}[.:]\d{2}\b/g);
  if (!times?.length) return group.time;
  return [...new Set(times)].join(" / ");
}
