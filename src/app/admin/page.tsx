"use client";

import { AttendanceBoard } from "@/components/attendance-board";
import { DailyQuoteCard } from "@/components/daily-quote-card";
import { GroupClassCard } from "@/components/group-class-card";
import { Card, RequestBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { pendingAttendanceBatches, studentName } from "@/data/accessors";
import { getInstructors } from "@/data/staff";
import { getClassGroupsForDay } from "@/data/groups";
import { formatLongDate, todayISO, weekdayFromISO } from "@/lib/dates";
import { DAY_LABELS } from "@/lib/labels";
import Link from "next/link";

export default function AdminHomePage() {
  const {
    postponeRequests,
    visiblePostponeRequests,
    remainingFor,
    visibleStudents,
    visibleSessions,
    isSuperAdmin,
  } = useStudio();

  const activeIds = new Set(visibleStudents.map((student) => student.id));
  const pending = visiblePostponeRequests.filter((request) => request.status === "pending");
  const today = todayISO();
  const todayDay = weekdayFromISO(today);
  const todayGroups = todayDay ? getClassGroupsForDay(todayDay) : [];
  const attendancePending = pendingAttendanceBatches(visibleSessions, activeIds);
  const groupsWithStudents = todayGroups.filter((group) =>
    visibleStudents.some((student) => student.groupId === group.id),
  );
  const teamCount = getInstructors().length;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Ana sayfa</h1>
      </header>

      <DailyQuoteCard date={today} />

      <div
        className={`grid grid-cols-2 gap-3 ${isSuperAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
      >
        <StatCard label="Öğrenci" value={String(visibleStudents.length)} href="/admin/ogrenciler" />
        <StatCard
          label="Yoklama"
          value={String(attendancePending.length)}
          href="/admin/yoklama"
        />
        <StatCard label="Talep" value={String(pending.length)} href="/admin/talepler" />
        {isSuperAdmin ? (
          <StatCard label="Ekip" value={String(teamCount)} href="/admin/ekip" />
        ) : null}
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">Yoklama onayı</h2>
          <Link href="/admin/yoklama" className="text-sm font-medium text-accent">
            Tümünü gör →
          </Link>
        </div>
        <AttendanceBoard />
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">
            Bugün{todayDay ? ` · ${DAY_LABELS[todayDay]}` : ""}
          </h2>
          <Link href="/admin/takvim" className="text-sm font-medium text-accent">
            Takvime git →
          </Link>
        </div>
        {groupsWithStudents.length === 0 ? (
          <p className="text-sm text-muted">Bugün dersin yok.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {groupsWithStudents.map((group) => (
              <GroupClassCard
                key={group.id}
                group={group}
                day={todayDay}
                students={visibleStudents}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">Son talepler</h2>
          <Link href="/admin/talepler" className="text-sm font-medium text-accent">
            Tümünü gör →
          </Link>
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted">Bekleyen erteleme talebi yok.</p>
        ) : (
          pending.slice(0, 3).map((request) => {
            const session = visibleSessions.find((item) => item.id === request.sessionId);
            return (
              <Card
                key={request.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-medium">
                    {studentName(request.studentId, visibleStudents)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {session
                      ? formatLongDate(session.date)
                      : formatLongDate(request.createdAt.slice(0, 10))}{" "}
                    · {remainingFor(request.studentId)} ders kaldı
                  </p>
                </div>
                <RequestBadge status={request.status} />
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="p-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="mt-1 font-serif text-2xl">{value}</p>
      </Card>
    </Link>
  );
}
