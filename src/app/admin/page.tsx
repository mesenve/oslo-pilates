"use client";

import { Card, RequestBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { studentName } from "@/data/accessors";
import { getClassGroupsForDay } from "@/data/groups";
import { formatLongDate, todayISO, weekdayFromISO } from "@/lib/dates";
import { DAY_LABELS } from "@/lib/labels";
import Link from "next/link";

export default function AdminHomePage() {
  const { postponeRequests, remainingFor, students, sessions } = useStudio();
  const pending = postponeRequests.filter((request) => request.status === "pending");
  const overdue = students.filter(
    (student) => student.package.paymentStatus === "overdue",
  );
  const today = todayISO();
  const todayDay = weekdayFromISO(today);
  const todayGroups = todayDay ? getClassGroupsForDay(todayDay) : [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Öğrenci" value={String(students.length)} href="/admin/ogrenciler" />
        <StatCard label="Talep" value={String(pending.length)} href="/admin/talepler" />
        <StatCard
          label="Gecikme"
          value={String(overdue.length)}
          href="/admin/ogrenciler"
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-serif text-2xl">
            Bugün{todayDay ? ` · ${DAY_LABELS[todayDay]}` : ""}
          </h2>
          <Link href="/admin/takvim" className="text-sm font-medium text-accent">
            Takvime git →
          </Link>
        </div>
        {todayGroups.length === 0 ? (
          <p className="text-sm text-muted">Bugün grup dersi yok.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {todayGroups.map((group) => (
              <Card key={group.id} className="p-5">
                <p className="font-medium">{group.label}</p>
                <p className="mt-1 text-sm text-muted">
                  {(todayDay && group.timeByDay?.[todayDay]) || group.time} ·{" "}
                  {group.capacity} kişilik
                </p>
              </Card>
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
            const session = sessions.find((item) => item.id === request.sessionId);
            return (
              <Card
                key={request.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-medium">
                    {studentName(request.studentId, students)}
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
