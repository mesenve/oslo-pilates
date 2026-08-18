"use client";

import { LastWeekCta } from "@/components/last-week-cta";
import { useCurrentStudent, useStudio } from "@/components/studio-provider";
import { Card } from "@/components/ui";
import { sessionsForStudent } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { addDays, formatLongDate, startOfWeekMonday, toISODate, todayISO } from "@/lib/dates";
import { remainingLabel } from "@/lib/labels";
import Link from "next/link";

export default function StudentHomePage() {
  const student = useCurrentStudent();
  const { sessions, remainingFor } = useStudio();
  if (!student) return null;

  const remaining = remainingFor(student.id);
  const group = getClassGroupById(student.groupId);
  const mine = sessionsForStudent(student.id, sessions);
  const upcoming = mine.find(
    (session) =>
      session.status === "upcoming" ||
      session.status === "attend_pending" ||
      session.status === "postpone_pending",
  );
  const monday = startOfWeekMonday();
  const today = todayISO();

  return (
    <div className="space-y-4">
      {student.package.isLastWeek ? (
        <LastWeekCta studentName={student.name} />
      ) : null}

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-serif text-xl">Bu hafta</h2>
          <Link href="/ogrenci/program" className="text-xs font-medium text-accent">
            Takvim
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, index) => {
            const iso = toISODate(addDays(monday, index));
            const session = mine.find((item) => item.date === iso);
            const isToday = iso === today;
            const label = addDays(monday, index).toLocaleDateString("tr-TR", {
              weekday: "short",
            });
            return (
              <div
                key={iso}
                className={`rounded-2xl px-1 py-2 text-center ${
                  isToday
                    ? "bg-gradient-to-b from-[#f8bbd0] to-accent-soft"
                    : "bg-white/70"
                }`}
              >
                <p className="text-[10px] capitalize text-muted">{label}</p>
                <p className="mt-1 text-sm font-medium">{iso.slice(8)}</p>
                <span
                  className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${
                    session
                      ? session.status === "attended"
                        ? "bg-emerald-500"
                        : session.status === "attend_pending" ||
                            session.status === "postpone_pending"
                          ? "bg-amber-500"
                          : "bg-accent"
                      : "bg-transparent"
                  }`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <Card className="p-4">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
          Sıradaki ders
        </p>
        {upcoming ? (
          <p className="mt-1 font-serif text-xl capitalize">
            {formatLongDate(upcoming.date)} · {group?.time}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Bekleyen dersin yok.</p>
        )}
        <p className="mt-1 text-sm text-muted">{remainingLabel(remaining)}</p>
        <Link
          href="/ogrenci/program"
          className="mt-2 inline-flex text-sm font-medium text-accent"
        >
          Takvimde aç →
        </Link>
      </Card>
    </div>
  );
}
