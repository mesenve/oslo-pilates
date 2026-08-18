"use client";

import { OpeningsBoard } from "@/components/openings-board";
import { Button, Card, EmptyState, RequestBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { studentName } from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { formatLongDate } from "@/lib/dates";

export default function RequestsPage() {
  const { postponeRequests, sessions, resolveRequest, students } = useStudio();

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Erteleme
        </p>
        <h1 className="mt-1 font-serif text-3xl">Talepler</h1>
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

            return (
              <Card key={request.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-serif text-2xl">
                      {studentName(request.studentId, students)}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {session
                        ? `Bu ders erteleniyor: ${formatLongDate(session.date)}`
                        : "Ders bulunamadı"}
                      {group ? ` · ${group.time}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Yeni ders için saat seçilmedi.
                    </p>
                    <p className="mt-3 text-sm">{request.reason}</p>
                    <p className="mt-2 text-xs text-muted">{student?.email}</p>
                  </div>
                  <RequestBadge status={request.status} />
                </div>
                {pending ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button onClick={() => resolveRequest(request.id, "approved")}>
                      Onayla
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => resolveRequest(request.id, "rejected")}
                    >
                      Reddet
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
