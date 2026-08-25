"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { Button, Card, EmptyState, SessionBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { effectiveSessionStatus, studentName } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { formatLongDate } from "@/lib/dates";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function InstructorLessonPage() {
  const params = useParams<{ date: string; groupId: string }>();
  const { visibleStudents, visibleSessions, markSessionByInstructor } = useStudio();

  const date = params.date;
  const groupId = params.groupId;
  const group = getClassGroupById(groupId);
  const studentIds = new Set(visibleStudents.map((student) => student.id));
  const sessions = visibleSessions
    .filter(
      (session) =>
        session.date === date &&
        session.groupId === groupId &&
        studentIds.has(session.studentId),
    )
    .sort((a, b) =>
      studentName(a.studentId, visibleStudents).localeCompare(
        studentName(b.studentId, visibleStudents),
        "tr",
      ),
    );

  if (!group) {
    return (
      <EmptyState>
        Ders bulunamadı.{" "}
        <Link href="/admin" className="text-accent">
          Geri dön
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Derslerim
      </Link>

      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Yoklama
        </p>
        <h1 className="mt-1 font-serif text-3xl capitalize">
          {formatLongDate(date)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {group.time} · {group.label}
        </p>
      </header>

      {sessions.length === 0 ? (
        <EmptyState>Bu derste öğrencin yok.</EmptyState>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const status = effectiveSessionStatus(session);
            const locked =
              status === "attended" ||
              status === "missed" ||
              status === "postponed";
            const pendingPostpone = status === "postpone_pending";
            return (
              <Card key={session.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-serif text-xl">
                    {studentName(session.studentId, visibleStudents)}
                  </p>
                  <SessionBadge status={status} />
                </div>
                {status === "attend_pending" ? (
                  <p className="text-sm text-amber-800">
                    Öğrenci Geldim işaretledi.
                  </p>
                ) : null}
                {pendingPostpone ? (
                  <p className="text-sm text-amber-800">
                    Erteleme talebi bekliyor.
                  </p>
                ) : null}
                {!locked ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="px-3 py-1.5"
                      onClick={() =>
                        markSessionByInstructor(session.id, "attended")
                      }
                    >
                      Geldi
                    </Button>
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5"
                      onClick={() =>
                        markSessionByInstructor(session.id, "postponed")
                      }
                    >
                      Erteleme
                    </Button>
                    <Button
                      variant="ghost"
                      className="px-3 py-1.5 text-red-700"
                      onClick={() =>
                        markSessionByInstructor(session.id, "missed")
                      }
                    >
                      Yandı
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted">Yoklama tamamlandı.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
