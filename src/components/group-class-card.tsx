"use client";

import { CalendarIcon, ChevronRightIcon, ClockIcon, UsersIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import { sortByName } from "@/lib/alphabet";
import { capacityLabel } from "@/lib/labels";
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
  const time = (day && group.timeByDay?.[day]) || group.time;

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
      >
        <div className="space-y-3">
          <Row icon={<CalendarIcon />} text={group.label} />
          <Row icon={<ClockIcon />} text={time} />
          <Row
            icon={<UsersIcon />}
            text={`${capacityLabel(group.capacity)} · ${members.length} kayıtlı`}
          />
        </div>
        <ChevronRightIcon
          className={`mt-1 h-5 w-5 shrink-0 text-muted transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </button>
      {open ? (
        <div className="border-t border-border px-4 py-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted">Bu grupta kayıtlı öğrenci yok.</p>
          ) : (
            <ul className="space-y-1">
              {members.map((student) => (
                <li key={student.id}>
                  <Link
                    href={`/admin/ogrenciler/${student.id}`}
                    className="block rounded-xl px-2 py-1.5 text-sm hover:bg-accent-soft/60"
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

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-accent">{icon}</span>
      <span>{text}</span>
    </div>
  );
}
