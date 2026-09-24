"use client";

import { DailyQuoteCard } from "@/components/daily-quote-card";
import { LastWeekCta } from "@/components/last-week-cta";
import { PilatesIcon } from "@/components/icons";
import { useCurrentStudent, useStudio } from "@/components/studio-provider";
import { Button, Card, SessionBadge } from "@/components/ui";
import { effectiveSessionStatus, postponeUsedDateInPackage, sessionsForStudent } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import {
  addDays,
  formatLongDate,
  isAtLeast24HoursAway,
  startOfWeekMonday,
  toISODate,
  todayISO,
  weekdayFromISO,
} from "@/lib/dates";
import { remainingLabel, postponeRightLabel } from "@/lib/labels";
import Link from "next/link";
import { useState } from "react";

export default function StudentHomePage() {
  const student = useCurrentStudent();
  const {
    sessions,
    postponeRequests,
    remainingFor,
    remainingPostponeFor,
    markAttended,
    requestPostpone,
    withdrawPostpone,
    requestRenewal,
  } = useStudio();
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(today);

  if (!student) return null;

  const remaining = remainingFor(student.id);
  const group = getClassGroupById(student.groupId);
  const mine = sessionsForStudent(student.id, sessions, student);
  const monday = startOfWeekMonday();
  const selectedSession = mine.find((session) => session.date === selectedDate);
  const hasPendingPostpone = Boolean(
    selectedSession && postponeRequests.some(
      (request) => request.sessionId === selectedSession.id && request.status === "pending",
    ),
  );
  const selectedStatus = selectedSession
    ? hasPendingPostpone
      ? "postpone_pending"
      : effectiveSessionStatus(selectedSession)
    : null;
  const isActiveSelected =
    selectedStatus === "upcoming" ||
    selectedStatus === "attend_pending" ||
    selectedStatus === "postpone_pending";
  const selectedDay = selectedSession ? weekdayFromISO(selectedSession.date) : null;
  const selectedTime =
    (selectedDay && group?.timeByDay?.[selectedDay]) ?? group?.time ?? "";
  const canPostponeSelected = Boolean(
    selectedSession &&
      selectedStatus === "upcoming" &&
      remainingPostponeFor(student.id) > 0 &&
      isAtLeast24HoursAway(selectedSession.date, selectedTime),
  );
  const postponeUsedDate = postponeUsedDateInPackage(
    student,
    postponeRequests,
    sessions,
  );
  const postponeLimit = student.monthlyPostponeLimit > 0 ? student.monthlyPostponeLimit : 0;

  return (
    <div className="space-y-4">
      <section
        className={`grid gap-3 ${remaining <= 2 ? "md:grid-cols-2" : ""}`}
      >
        <DailyQuoteCard date={today} />
        {remaining <= 2 ? (
          <LastWeekCta student={student} remaining={remaining} onRequestRenewal={requestRenewal} />
        ) : null}
      </section>

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
            const hasPendingPostpone = Boolean(
              session && postponeRequests.some(
                (request) => request.sessionId === session.id && request.status === "pending",
              ),
            );
            const isSelected = iso === selectedDate;
            const isToday = iso === today;
            const label = addDays(monday, index).toLocaleDateString("tr-TR", {
              weekday: "short",
            });
            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                aria-pressed={isSelected}
                aria-label={`${label} ${iso.slice(8)}`}
                className={`rounded-2xl px-1 py-2 text-center transition-colors ${
                  isSelected
                    ? "bg-gradient-to-b from-[#f8bbd0] to-accent-soft ring-1 ring-accent/25"
                    : isToday
                      ? "bg-white/90 ring-1 ring-accent/15"
                      : "bg-white/70 hover:bg-white/90"
                }`}
              >
                <p className="text-[10px] capitalize text-muted">{label}</p>
                <p className="mt-1 text-sm font-medium">{iso.slice(8)}</p>
                <span
                  className={`mx-auto mt-1 block h-1.5 w-1.5 rounded-full ${
                    session
                      ? session.status === "attended"
                        ? "bg-emerald-500"
                        : hasPendingPostpone ||
                            session.status === "attend_pending" ||
                            session.status === "postpone_pending"
                          ? "bg-amber-500"
                          : "bg-accent"
                      : "bg-transparent"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </section>

      <Card className="overflow-hidden">
        {selectedSession && selectedStatus ? (
          <>
            <p className="px-4 pt-4 text-[10px] uppercase tracking-[0.16em] text-muted">
              {selectedDate === today ? "Bugünkü ders" : "Dersin"}
            </p>
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-soft">
                <PilatesIcon className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1 border-l border-border/60 pl-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-serif text-2xl leading-none tracking-tight tabular-nums">
                      {group?.time}
                    </p>
                    <p className="mt-1 capitalize text-sm text-muted">
                      {formatLongDate(selectedSession.date)}
                    </p>
                  </div>
                  {selectedStatus !== "upcoming" ? (
                    <SessionBadge status={selectedStatus} />
                  ) : null}
                </div>
              </div>
            </div>
            {isActiveSelected ? (
              <div className="border-t border-border/60 px-4 py-3">
                <p className="text-sm text-muted">{remainingLabel(remaining)}</p>
                <p className="text-sm text-muted">
                  {postponeRightLabel(
                    remainingPostponeFor(student.id),
                    postponeLimit,
                    postponeUsedDate,
                  )}
                </p>
                {selectedStatus === "upcoming" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDate === today ? (
                      <Button onClick={() => markAttended(selectedSession.id)}>
                        Geldim
                      </Button>
                    ) : selectedDate > today && canPostponeSelected ? (
                      <Button
                        variant="secondary"
                        onClick={() => requestPostpone(selectedSession.id, "")}
                      >
                        Ertele
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {hasPendingPostpone ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => void withdrawPostpone(selectedSession.id)}
                    >
                      Erteleme talebini geri al
                    </Button>
                  </div>
                ) : null}
                {selectedDate > today &&
                selectedStatus === "upcoming" &&
                !canPostponeSelected ? (
                  <p className="mt-3 text-sm text-muted">
                    {remainingPostponeFor(student.id) <= 0
                      ? "Bu pakette erteleme hakkın kalmadı."
                      : "Ders başlangıcına 24 saatten az kaldığı için ertelenemez."}
                  </p>
                ) : null}
              </div>
            ) : null}
            {(selectedStatus === "postponed" || selectedStatus === "postpone_pending") &&
            (postponeRequests.find((r) => r.sessionId === selectedSession.id)?.reason?.trim() ||
              student.postponeLessonNote?.trim()) ? (
              <div className="border-t border-border/60 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Erteleme notu
                </p>
                <p className="mt-1 text-sm">
                  {postponeRequests.find((r) => r.sessionId === selectedSession.id)?.reason?.trim() ||
                    student.postponeLessonNote}
                </p>
              </div>
            ) : null}
            <div className="border-t border-border/60 px-4 py-3">
              <Link
                href="/ogrenci/program"
                className="inline-flex text-sm font-medium text-accent"
              >
                Takvimde aç →
              </Link>
            </div>
          </>
        ) : (
          <div className="p-4">
            <p className="font-serif text-xl">
              {selectedDate === today ? "Bugün ders yok" : "Bu günde ders yok"}
            </p>
            <p className="mt-1 text-sm text-muted">
              {selectedDate === today
                ? "Bugün programında ders görünmüyor. Haftadan başka bir güne tıklayabilirsin."
                : "Seçtiğin günde ders görünmüyor. Pembe noktalı günlere tıkla."}
            </p>
            <Link
              href="/ogrenci/program"
              className="mt-3 inline-flex text-sm font-medium text-accent"
            >
              Takvime git →
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
