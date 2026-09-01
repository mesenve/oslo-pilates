"use client";

import { ClassCalendar } from "@/components/class-calendar";
import { ChevronLeftIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { Button, Card, ConfirmDialog, EmptyState, PaymentBadge, RequestBadge, SessionBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import {
  effectiveSessionStatus,
  remainingPostponeRights,
  sessionCounts,
  sessionsForStudent,
} from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { getStaffById } from "@/data/staff";
import { formatLongDate, todayISO } from "@/lib/dates";
import { inviteUrl, isInviteValid } from "@/lib/student-auth";
import { sendInviteEmail } from "@/lib/invite-client";
import { remainingLabel, postponeRightAdminLabel } from "@/lib/labels";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    visibleStudents,
    visibleSessions,
    remainingFor,
    visiblePostponeRequests,
    approveRequest,
    archiveStudent,
    resendStudentInvite,
    isSuperAdmin,
  } = useStudio();
  const router = useRouter();
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [resendError, setResendError] = useState<string | null>(null);
  const student = visibleStudents.find((item) => item.id === params.id);
  const mine = sessionsForStudent(student?.id ?? "", visibleSessions);
  const today = todayISO();
  const defaultDate =
    mine.find((session) => session.date >= today)?.date ??
    mine.at(-1)?.date ??
    today;
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const marks = mine.map((session) => ({
    date: session.date,
    status: effectiveSessionStatus(session),
  }));
  const selected = mine.filter((session) => session.date === selectedDate);
  const counts = sessionCounts(student?.id ?? "", visibleSessions);
  const group = student ? getClassGroupById(student.groupId) : undefined;
  const requests = visiblePostponeRequests.filter(
    (request) => request.studentId === student?.id,
  );

  if (!student) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ogrenciler" className="text-sm text-muted">
          ← Öğrenciler
        </Link>
        <EmptyState>
          {isSuperAdmin ? "Öğrenci bulunamadı." : "Bu öğrenci sana atanmamış."}
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/ogrenciler"
        className="inline-flex items-center gap-1 text-sm text-muted"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        Öğrenciler
      </Link>

      <header>
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 font-serif text-3xl leading-none">{student.name}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/admin/ogrenciler/${student.id}/duzenle`}>
              <Button variant="secondary" className="px-3 py-1.5">
                <PencilIcon className="h-4 w-4" />
                Düzenle
              </Button>
            </Link>
            {isSuperAdmin ? (
              <Button
                variant="secondary"
                className="px-3 py-1.5"
                onClick={() => setConfirmDelete(true)}
              >
                <TrashIcon className="h-4 w-4" />
                Sil
              </Button>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-sm text-muted">
          {group?.label}
          {getStaffById(student.instructorId)
            ? ` · Eğitmen: ${getStaffById(student.instructorId)?.name}`
            : ""}
        </p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Geldi" value={String(counts.attended)} />
        <Stat label="Erteleme" value={String(counts.postponed)} />
        <Stat label="Yandı" value={String(counts.burned)} />
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">{remainingLabel(remainingFor(student.id))}</p>
          <PaymentBadge status={student.package.paymentStatus} />
        </div>
        <p className="text-sm text-muted">
          {postponeRightAdminLabel(
            student.monthlyPostponeLimit -
              remainingPostponeRights(student, visiblePostponeRequests),
            student.monthlyPostponeLimit,
          )}
        </p>
        <p className="text-xs text-muted">
          {student.email} · {student.phone}
        </p>
        {student.note?.trim() ? (
          <div className="rounded-2xl bg-accent-soft/60 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              Not
            </p>
            <p className="mt-1 text-sm">{student.note}</p>
          </div>
        ) : null}
      </Card>

      {student.accountStatus === "invited" ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-medium text-amber-800">Davet bekliyor</p>
          <p className="text-sm text-muted">
            Öğrenci henüz maildeki linkten şifresini oluşturmadı.
            {!isInviteValid(student) ? " Davet süresi dolmuş olabilir." : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {student.inviteToken ? (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const link = inviteUrl(student.inviteToken!);
                  try {
                    await navigator.clipboard.writeText(link);
                    setCopiedInvite(true);
                    window.setTimeout(() => setCopiedInvite(false), 2000);
                  } catch {
                    setCopiedInvite(false);
                  }
                }}
              >
                {copiedInvite ? "Link kopyalandı" : "Davet linkini kopyala"}
              </Button>
            ) : null}
            <Button
              type="button"
              disabled={resendStatus === "sending"}
              onClick={async () => {
                setResendStatus("sending");
                setResendError(null);
                const result = resendStudentInvite(student.id);
                if (result.error || !result.inviteUrl) {
                  setResendStatus("error");
                  setResendError(result.error ?? "Davet linki oluşturulamadı.");
                  return;
                }
                try {
                  await sendInviteEmail({
                    name: student.name,
                    email: student.email,
                    inviteUrl: result.inviteUrl,
                    student: {
                      ...student,
                      inviteToken: result.inviteToken,
                      inviteExpiresAt: result.inviteExpiresAt,
                      invitedAt: result.invitedAt,
                    },
                    sessions: visibleSessions.filter(
                      (session) => session.studentId === student.id,
                    ),
                    expiresAt: result.inviteExpiresAt ?? student.inviteExpiresAt ?? "",
                  });
                  setResendStatus("sent");
                  window.setTimeout(() => setResendStatus("idle"), 3000);
                } catch (error) {
                  setResendStatus("error");
                  setResendError(
                    error instanceof Error ? error.message : "Davet maili gönderilemedi.",
                  );
                }
              }}
            >
              {resendStatus === "sending"
                ? "Mail gönderiliyor…"
                : resendStatus === "sent"
                  ? "Mail gönderildi"
                  : "Davet mailini yeniden gönder"}
            </Button>
          </div>
          {resendStatus === "error" && resendError ? (
            <p className="text-sm text-red-700">{resendError}</p>
          ) : null}
        </Card>
      ) : null}

      <ClassCalendar
        marks={marks}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {selected.length === 0 ? (
        <EmptyState>Bu günde dersi yok.</EmptyState>
      ) : (
        selected.map((session) => {
          const status = effectiveSessionStatus(session);
          const request = requests.find((item) => item.sessionId === session.id);
          return (
            <Card key={session.id} className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="capitalize">{formatLongDate(session.date)}</p>
                <SessionBadge status={status} />
              </div>
              <p className="text-sm text-muted">{group?.time}</p>
              {request ? (
                <p className="text-sm">
                  Erteleme: {request.reason}
                </p>
              ) : null}
              {status === "missed" ? (
                <p className="text-sm text-rose-700">Bu ders yanmış.</p>
              ) : null}
              {status === "attend_pending" ? (
                <p className="text-sm text-amber-800">
                  Geldim işaretledi. Grup onayı bekleniyor.
                </p>
              ) : null}
              {status === "postponed" ? (
                <p className="text-sm text-amber-800">Bu ders ertelendi.</p>
              ) : null}
              {status === "postpone_pending" ? (
                <p className="text-sm text-amber-800">
                  Erteleme talebi onay bekliyor.
                </p>
              ) : null}
            </Card>
          );
        })
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Erteleme</h2>
        {requests.length === 0 ? (
          <EmptyState>Bu öğrencinin erteleme kaydı yok.</EmptyState>
        ) : (
          requests.map((request) => {
            const session = visibleSessions.find((item) => item.id === request.sessionId);
            return (
              <Card key={request.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="capitalize">
                    {session ? formatLongDate(session.date) : "Ders bulunamadı"}
                  </p>
                  <RequestBadge status={request.status} />
                </div>
                <p className="text-sm text-muted">{group?.time}</p>
                <p className="text-sm">{request.reason}</p>
                {request.status === "pending" ? (
                  <Button onClick={() => approveRequest(request.id)}>Onayla</Button>
                ) : null}
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Tüm dersler</h2>
        {mine.map((session) => {
          const status = effectiveSessionStatus(session);
          return (
            <button
              key={session.id}
              type="button"
              onClick={() => setSelectedDate(session.date)}
              className="flex w-full items-center justify-between rounded-2xl bg-white/70 px-3 py-3 text-left"
            >
              <span className="text-sm capitalize">
                {formatLongDate(session.date)}
              </span>
              <SessionBadge status={status} />
            </button>
          );
        })}
      </section>

      {confirmDelete ? (
        <ConfirmDialog
          title="Öğrenciyi sil"
          body="Bu öğrenciyi silmek istediğine emin misin?"
          confirmLabel="Sil"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            archiveStudent(student.id);
            router.replace("/admin/arsiv");
          }}
        />
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
    </Card>
  );
}
