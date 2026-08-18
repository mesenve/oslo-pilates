"use client";

import { OpeningsBoard } from "@/components/openings-board";
import { Button, Card, EmptyState, RequestBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { remainingPostponeRights, studentName } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { formatLongDate } from "@/lib/dates";
import { postponeRightAdminLabel } from "@/lib/labels";

export default function RequestsPage() {
  const { postponeRequests, sessions, students, approveRequest } = useStudio();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Erteleme
        </p>
        <h1 className="mt-1 font-serif text-3xl">Talepler</h1>
        <p className="mt-1 text-sm text-muted">
          Öğrenci aylık hakkıyla talep gönderir; sen onaylarsın.
        </p>
      </header>

      <OpeningsBoard requests={postponeRequests} sessions={sessions} />

      <section className="space-y-3">
        <h2 className="font-serif text-2xl">Erteleme talepleri</h2>
        {postponeRequests.length === 0 ? (
          <EmptyState>Henüz erteleme talebi yok.</EmptyState>
        ) : (
          postponeRequests.map((request) => {
            const session = sessions.find((item) => item.id === request.sessionId);
            const student = students.find((item) => item.id === request.studentId);
            const group = session ? getClassGroupById(session.groupId) : undefined;
            const pending = request.status === "pending";
            const used = student
              ? student.monthlyPostponeLimit -
                remainingPostponeRights(student, postponeRequests)
              : 0;

            return (
              <Card key={request.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-serif text-2xl">
                      {studentName(request.studentId, students)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {session
                        ? `${pending ? "Bu ders erteleniyor" : "Bu ders ertelendi"}: ${formatLongDate(session.date)}`
                        : "Ders bulunamadı"}
                      {group ? ` · ${group.time}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Yeni ders için saat seçilmedi.
                    </p>
                    {student ? (
                      <p className="mt-1 text-xs text-muted">
                        {postponeRightAdminLabel(
                          used,
                          student.monthlyPostponeLimit,
                        )}
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm">{request.reason}</p>
                    <p className="mt-2 text-xs text-muted">{student?.email}</p>
                  </div>
                  <RequestBadge status={request.status} />
                </div>
                {pending ? (
                  <div className="mt-4">
                    <Button onClick={() => approveRequest(request.id)}>
                      Onayla
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
