"use client";

import { ChevronLeftIcon } from "@/components/icons";
import { Button, Card, EmptyState, SessionBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { effectiveSessionStatus, studentName } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { formatLongDate } from "@/lib/dates";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function InstructorLessonPage() {
  const params = useParams<{ date: string; groupId: string }>();
  const { visibleStudents, visibleSessions, markSessionByInstructor } = useStudio();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function setStatus(
    sessionId: string,
    outcome: "attended" | "postponed" | "missed",
  ) {
    if (busyId) return;
    setBusyId(sessionId);
    setError(null);
    try {
      const ok = await markSessionByInstructor(sessionId, outcome);
      if (!ok) setError("Ders durumu güncellenemedi. Tekrar dene.");
    } catch {
      setError("Ders durumu güncellenemedi. Tekrar dene.");
    } finally {
      setBusyId(null);
    }
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
        <h1 className="font-serif text-3xl capitalize">
          {formatLongDate(date)}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {groupId === "duzensiz" ? "Özel program" : `${group.time} · ${group.label}`}
        </p>
      </header>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {sessions.length === 0 ? (
        <EmptyState>Bu derste öğrencin yok.</EmptyState>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => {
            const status = effectiveSessionStatus(session);
            const pendingPostpone = status === "postpone_pending";
            const student = visibleStudents.find((item) => item.id === session.studentId);
            const sessionTime =
              student?.package.customSchedule?.time ?? group.time;
            return (
              <Card key={session.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-serif text-xl">
                    {studentName(session.studentId, visibleStudents)}
                  </p>
                  <SessionBadge status={status} />
                </div>
                <p className="text-sm text-muted">{sessionTime}</p>
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    className="px-3 py-1.5"
                    disabled={busyId !== null}
                    onClick={() => void setStatus(session.id, "attended")}
                  >
                    Geldi
                  </Button>
                  <Button
                    variant="secondary"
                    className="px-3 py-1.5"
                    disabled={busyId !== null}
                    onClick={() => void setStatus(session.id, "postponed")}
                  >
                    Erteleme
                  </Button>
                  <Button
                    variant="ghost"
                    className="px-3 py-1.5 text-red-700"
                    disabled={busyId !== null}
                    onClick={() => void setStatus(session.id, "missed")}
                  >
                    Yandı
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
