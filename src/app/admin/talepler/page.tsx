"use client";

import { OpeningsBoard } from "@/components/openings-board";
import { Button, Card, EmptyState, RequestBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { remainingPostponeRights, postponeUsedDateInPackage, studentName } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { formatLongDate } from "@/lib/dates";
import { postponeRightAdminLabel } from "@/lib/labels";
import { useState } from "react";

export default function RequestsPage() {
  const { visiblePostponeRequests, visibleSessions, visibleStudents, approveRequest } =
    useStudio();
  const visibleRequests = visiblePostponeRequests;
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-serif text-3xl">Talepler</h1>
        <p className="mt-1 text-sm text-muted">
          Öğrenci paket başına hakkıyla talep gönderir; sen onaylarsın.
        </p>
      </header>

      <OpeningsBoard requests={visibleRequests} sessions={visibleSessions} />

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Erteleme talepleri</h2>
        {visibleRequests.length === 0 ? (
          <EmptyState>Henüz erteleme talebi yok.</EmptyState>
        ) : (
          visibleRequests.map((request) => {
            const session = visibleSessions.find((item) => item.id === request.sessionId);
            const student = visibleStudents.find((item) => item.id === request.studentId);
            const group = session ? getClassGroupById(session.groupId) : undefined;
            const pending = request.status === "pending";
            const used = student
              ? student.monthlyPostponeLimit -
                remainingPostponeRights(
                  student,
                  visiblePostponeRequests,
                  visibleSessions,
                )
              : 0;
            const usedDate = student
              ? postponeUsedDateInPackage(
                  student,
                  visiblePostponeRequests,
                  visibleSessions,
                )
              : null;

            return (
              <Card key={request.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-serif text-2xl">
                      {studentName(request.studentId, visibleStudents)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {session
                        ? `${pending ? "Bu ders erteleniyor" : "Bu ders ertelendi"}: ${formatLongDate(session.date)}`
                        : "Ders bulunamadı"}
                      {group ? ` · ${group.time}` : ""}
                    </p>
                    {student ? (
                      <p className="mt-1 text-xs text-muted">
                        {postponeRightAdminLabel(
                          used,
                          student.monthlyPostponeLimit,
                          usedDate,
                          pending ? session?.date : null,
                        )}
                      </p>
                    ) : null}
                    {request.reason?.trim() ? (
                      <p className="mt-3 text-sm">
                        <span className="text-muted">Erteleme notu: </span>
                        {request.reason}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted">{student?.email}</p>
                  </div>
                  <RequestBadge status={request.status} />
                </div>
                {pending ? (
                  <div className="mt-4">
                    <Button
                      disabled={approvingId === request.id}
                      onClick={() => {
                        if (approvingId) return;
                        setError(null);
                        setApprovingId(request.id);
                        void approveRequest(request.id)
                          .then((ok) => {
                            if (!ok) {
                              setError("Talep onaylanamadı. Tekrar dene.");
                            }
                          })
                          .catch(() => {
                            setError("Talep onaylanamadı. Tekrar dene.");
                          })
                          .finally(() => setApprovingId(null));
                      }}
                    >
                      {approvingId === request.id ? "Onaylanıyor…" : "Onayla"}
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
