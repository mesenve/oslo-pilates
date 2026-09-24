"use client";

import { ClassCalendar } from "@/components/class-calendar";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/icons";
import { Button, Card, ConfirmDialog, EmptyState, PaymentBadge, RequestBadge, SessionBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import {
  effectiveSessionStatus,
  postponePendingDateInPackage,
  postponeUsedDateInPackage,
  remainingPostponeRights,
  sessionCounts,
  sessionsForStudent,
} from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { getStaffById, instructorLabelForId } from "@/data/staff";
import { formatLongDate, todayISO } from "@/lib/dates";
import { inviteUrl, isInviteValid } from "@/lib/student-auth";
import { saveInviteLink, sendInviteEmail } from "@/lib/invite-client";
import { DAY_LABELS, remainingLabel, postponeRightAdminLabel } from "@/lib/labels";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const CHANGE_FIELD_LABELS: Record<string, string> = {
  name: "Ad değişikliği",
  email: "E-posta değişikliği",
  phone: "Telefon değişikliği",
  groupId: "Program değişikliği",
  instructorId: "Eğitmen değişikliği",
  "package.startDate": "Paket değişikliği",
  "package.totalSessions": "Paket değişikliği",
  "package.paymentStatus": "Ödeme durumu değişikliği",
};

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const {
    visibleStudents,
    visibleSessions,
    remainingFor,
    visiblePostponeRequests,
    approveRequest,
    markSessionByInstructor,
    setPostponeLessonUsed,
    setPostponeRequestReason,
    archiveStudent,
    resendStudentInvite,
    isSuperAdmin,
    reviewRenewal,
  } = useStudio();
  const router = useRouter();
  const student = visibleStudents.find((item) => item.id === params.id);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [resendError, setResendError] = useState<string | null>(null);
  const [inviteAccount, setInviteAccount] = useState<{
    exists: boolean;
    activated: boolean;
  } | null>(null);
  const studentId = student?.id;
  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    void fetch(`/api/invite/status?studentId=${encodeURIComponent(studentId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data) setInviteAccount(data);
      })
      .catch(() => {
        if (!cancelled) setInviteAccount(null);
      });
    return () => {
      cancelled = true;
    };
  }, [studentId]);
  const mine = sessionsForStudent(student?.id ?? "", visibleSessions, student);
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
  const counts = sessionCounts(student?.id ?? "", visibleSessions, student);
  const group = student ? getClassGroupById(student.groupId) : undefined;
  const customSchedule = student?.package.customSchedule;
  const customTime = customSchedule?.time?.trim() ?? "";
  const hasCustomTime = Boolean(customTime && customTime !== "Belirtilmedi" && customTime !== "—");
  const scheduleLabel = customSchedule?.days.length
    ? `${customSchedule.days.map((day) => DAY_LABELS[day]).join(", ")} · ${hasCustomTime ? customTime : "Saat bilgisi yok"}`
    : "";
  const groupLabel = group?.label ?? "Program bilgisi yok";
  const lessonTime = hasCustomTime ? customTime : (group?.time && group.time !== "Belirtilmedi" && group.time !== "—" ? group.time : "Saat bilgisi yok");
  const requests = visiblePostponeRequests.filter(
    (request) => request.studentId === student?.id,
  );
  const noteRequest =
    requests.find((request) => request.status === "approved") ??
    requests.find((request) => request.status === "pending") ??
    requests[0];

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
          {groupLabel}
          {scheduleLabel ? ` · ${scheduleLabel}` : ""}
          {getStaffById(student.instructorId)
            ? ` · Eğitmen: ${instructorLabelForId(student.instructorId)}`
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
              remainingPostponeRights(
                student,
                visiblePostponeRequests,
                visibleSessions,
              ),
            student.monthlyPostponeLimit,
            postponeUsedDateInPackage(
              student,
              visiblePostponeRequests,
              visibleSessions,
            ),
            postponePendingDateInPackage(
              student,
              visiblePostponeRequests,
              visibleSessions,
            ),
          )}
        </p>
        <p className="text-xs text-muted">
          {student.email} · {student.phone}
        </p>
        <p className="text-xs text-muted">
          {student.package.paymentUpdatedAt ? `Ödeme durumu son güncelleme: ${formatLongDate(student.package.paymentUpdatedAt.slice(0, 10))}` : "Ödeme durumu henüz güncellenmedi."}
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

      {student.renewalRequest ? (
        <Card className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-serif text-xl">Yenileme talebi</h2><RequestBadge status={student.renewalRequest.status === "pending" ? "pending" : student.renewalRequest.status} /></div>
          <p className="text-sm text-muted">{student.renewalRequest.requestedStartDate ? `Tercih edilen başlangıç: ${formatLongDate(student.renewalRequest.requestedStartDate)}` : "Başlangıç tarihi belirtilmedi."}</p>
          {student.renewalRequest.status === "pending" ? <div className="flex flex-wrap gap-2"><Button onClick={() => void reviewRenewal(student.id, "approved")}>Talebi kabul et</Button><Button variant="danger" onClick={() => void reviewRenewal(student.id, "rejected")}>Reddet</Button></div> : null}
        </Card>
      ) : null}

      {student.changeLog?.length ? <Card className="space-y-3 p-4"><h2 className="font-serif text-xl">Değişiklik günlüğü</h2>{student.changeLog.slice(0, 8).map((entry) => <p key={entry.id} className="text-sm text-muted">{formatLongDate(entry.createdAt.slice(0, 10))} · {getStaffById(entry.actorId)?.name ?? entry.actorId} · {CHANGE_FIELD_LABELS[entry.field] ?? "Bilgi değişikliği"}: {entry.before || "—"} → {entry.after || "—"}</p>)}</Card> : null}

      {student.packageHistory?.length ? (
        <Card className="space-y-3 p-4">
          <div>
            <h2 className="font-serif text-xl">Paket geçmişi</h2>
            <p className="mt-1 text-xs text-muted">
              Önceki paket dönemleri saklanır; mevcut paket düzenlenirken silinmez.
            </p>
          </div>
          <div className="space-y-2">
            {[...student.packageHistory].reverse().map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-muted/50 px-3 py-2 text-sm"
              >
                <span>
                  {formatLongDate(item.startDate)} – {formatLongDate(item.endDate)}
                </span>
                <span className="text-muted">
                  {item.totalSessions} seans · {item.paymentStatus === "paid" ? "Ödendi" : item.paymentStatus === "pending" ? "Bekliyor" : "Gecikmiş"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {student.accountStatus === "active" ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-medium">Hesap aktif</p>
          <p className="text-sm text-muted">
            Giriş sorunu varsa şifre sıfırlama maili gönder. Öğrencinin kayıtlı
            e-postası: {student.email}
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={resendStatus === "sending"}
            onClick={async () => {
              setResendStatus("sending");
              setResendError(null);
              try {
                const response = await fetch("/api/auth/student/forgot", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ email: student.email }),
                });
                if (!response.ok) {
                  throw new Error("Şifre sıfırlama maili gönderilemedi.");
                }
                setResendStatus("sent");
                window.setTimeout(() => setResendStatus("idle"), 3000);
              } catch (error) {
                setResendStatus("error");
                setResendError(
                  error instanceof Error
                    ? error.message
                    : "Şifre sıfırlama maili gönderilemedi.",
                );
              }
            }}
          >
            {resendStatus === "sending"
              ? "Mail gönderiliyor…"
              : resendStatus === "sent"
                ? "Sıfırlama maili gönderildi"
                : "Şifre sıfırlama maili gönder"}
          </Button>
          {resendStatus === "error" && resendError ? (
            <p className="text-sm text-red-700">{resendError}</p>
          ) : null}
        </Card>
      ) : null}

      {student.accountStatus === "invited" || inviteAccount?.activated === false || inviteAccount?.exists === false ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm font-medium text-amber-800">Davet bekliyor</p>
          <p className="text-sm text-muted">
            {inviteAccount?.exists === false
              ? "Bu öğrenci için henüz davet oluşturulmadı."
              : "Öğrenci henüz maildeki linkten şifresini oluşturmadı."}
            {student.inviteToken && !isInviteValid(student)
              ? " Davet süresi dolmuş olabilir."
              : ""}
          </p>
          <div className="flex flex-wrap gap-2">
            {student.inviteToken ? (
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  const link = inviteUrl(student.inviteToken!);
                  try {
                    await saveInviteLink({
                      name: student.name,
                      email: student.email,
                      inviteUrl: link,
                      student,
                      sessions: visibleSessions.filter(
                        (session) => session.studentId === student.id,
                      ),
                      expiresAt: student.inviteExpiresAt ?? "",
                    });
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
                const result = await resendStudentInvite(student.id);
                if (result.passwordResetOnly) {
                  try {
                    const response = await fetch("/api/auth/student/forgot", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: student.email }),
                    });
                    if (!response.ok) throw new Error("Mail gönderilemedi.");
                    setResendStatus("sent");
                    window.setTimeout(() => setResendStatus("idle"), 3000);
                  } catch (error) {
                    setResendStatus("error");
                    setResendError(
                      error instanceof Error ? error.message : "Mail gönderilemedi.",
                    );
                  }
                  return;
                }
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
                  : student.inviteToken
                    ? "Davet mailini yeniden gönder"
                    : "Davet mailini gönder"}
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
              {lessonTime ? <p className="text-sm text-muted">{lessonTime}</p> : null}
              {request?.reason ? <p className="text-sm">Erteleme notu: {request.reason}</p> : null}
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
                {lessonTime ? <p className="text-sm text-muted">{lessonTime}</p> : null}
                {request.status === "pending" ? (
                  <Button
                    disabled={approvingId === request.id}
                    onClick={() => {
                      if (approvingId) return;
                      setApprovingId(request.id);
                      void approveRequest(request.id)
                        .catch(() => undefined)
                        .finally(() => setApprovingId(null));
                    }}
                  >
                    {approvingId === request.id ? "Onaylanıyor…" : "Onayla"}
                  </Button>
                ) : null}
                {request.actedAt ? <p className="text-xs text-muted">İşlemi yapan: {getStaffById(request.actedBy ?? "")?.name ?? request.actedBy ?? "—"}</p> : null}
              </Card>
            );
          })
        )}
      </section>

      <PostponeUsedCard
        key={`${
          postponeUsedDateInPackage(
            student,
            visiblePostponeRequests,
            visibleSessions,
          ) ?? student.postponeLessonUsedAt ?? "unused"
        }:${noteRequest?.id ?? "none"}:${noteRequest?.reason ?? ""}`}
        used={student.postponeLessonUsed ?? false}
        usedAt={
          postponeUsedDateInPackage(
            student,
            visiblePostponeRequests,
            visibleSessions,
          ) ?? student.postponeLessonUsedAt ?? ""
        }
        note={noteRequest?.reason ?? ""}
        onChange={(used, usedAt) =>
          void setPostponeLessonUsed(student.id, used, usedAt)
        }
        onNoteBlur={
          noteRequest
            ? (reason) => {
                if (reason.trim() !== (noteRequest.reason ?? "").trim()) {
                  void setPostponeRequestReason(noteRequest.id, reason);
                }
              }
            : undefined
        }
      />

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Tüm dersler</h2>
        {mine.map((session) => {
          const status = effectiveSessionStatus(session);
          const canChangeStatus = session.date < today || status !== "upcoming";
          const pickerStatus =
            status === "attend_pending"
              ? "attended"
              : status === "postpone_pending"
                ? "postponed"
                : status;
          return (
            <div
              key={session.id}
              className="flex w-full items-center justify-between rounded-2xl bg-white/70 px-3 py-3 text-left"
            >
              <button
                type="button"
                onClick={() => setSelectedDate(session.date)}
                className="min-w-0 flex-1 text-left text-sm capitalize"
              >
                {formatLongDate(session.date)}
              </button>
              {canChangeStatus ? (
                <AttendanceStatusPicker
                  status={pickerStatus as "attended" | "postponed" | "missed"}
                  onChange={(nextStatus) =>
                    markSessionByInstructor(session.id, nextStatus)
                  }
                />
              ) : (
                <SessionBadge status={status} />
              )}
            </div>
          );
        })}
      </section>

      {confirmDelete ? (
        <ConfirmDialog
          title="Öğrenciyi sil"
          body="Bu öğrenciyi silmek istediğine emin misin?"
          confirmLabel="Sil"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            if (await archiveStudent(student.id)) {
              router.replace("/admin/arsiv");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function AttendanceStatusPicker({
  status,
  onChange,
}: {
  status: "attended" | "postponed" | "missed";
  onChange: (status: "attended" | "postponed" | "missed") => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const options: Array<{
    value: "attended" | "postponed" | "missed";
    label: string;
    className: string;
  }> = [
    {
      value: "attended",
      label: "Geldi",
      className: "border-emerald-100 bg-emerald-50 text-emerald-800",
    },
    {
      value: "postponed",
      label: "Erteleme",
      className: "border-amber-100 bg-amber-50 text-amber-800",
    },
    {
      value: "missed",
      label: "Yandı",
      className: "border-red-100 bg-red-50 text-red-700",
    },
  ];
  const current = options.find((option) => option.value === status) ?? options[0];

  useEffect(() => {
    if (!open) return;

    const closeWhenClickingOutside = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeWhenClickingOutside);
    return () => document.removeEventListener("pointerdown", closeWhenClickingOutside);
  }, [open]);

  return (
    <div ref={pickerRef} className="relative ml-3 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors hover:brightness-95 ${current.className}`}
      >
        {current.label}
        <ChevronDownIcon className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-36 rounded-2xl border border-border bg-white p-1.5 shadow-[0_12px_28px_rgba(194,24,91,0.16)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PostponeUsedCard({
  used,
  usedAt,
  note,
  onChange,
  onNoteBlur,
}: {
  used: boolean;
  usedAt: string;
  note: string;
  onChange: (used: boolean, usedAt?: string) => void;
  onNoteBlur?: (reason: string) => void;
}) {
  const [dateValue, setDateValue] = useState(usedAt || todayISO());

  return (
    <Card className="space-y-3 p-4">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={used}
          onChange={(event) =>
            onChange(event.target.checked, dateValue || todayISO())
          }
          className="peer sr-only"
        />
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft/30 text-white shadow-[0_3px_10px_rgba(194,24,91,0.1)] transition peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft/70 peer-checked:border-accent peer-checked:bg-accent">
          <CheckIcon className="h-4 w-4 opacity-0 transition peer-checked:opacity-100" />
        </span>
        <span className="text-sm font-medium">Erteleme hakkı kullanıldı</span>
      </label>
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-[0.16em] text-muted">
          Kullanıldığı tarih
        </label>
        <input
          type="date"
          value={dateValue}
          onChange={(event) => {
            const next = event.target.value;
            setDateValue(next);
            if (used) onChange(true, next);
          }}
          className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
        />
      </div>
      {onNoteBlur ? (
        <label className="block space-y-1">
          <span className="text-xs uppercase tracking-[0.16em] text-muted">
            Erteleme notu
          </span>
          <textarea
            defaultValue={note}
            rows={2}
            placeholder="Öğrencinin göreceği erteleme notu…"
            className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
            onBlur={(event) => onNoteBlur(event.target.value)}
          />
        </label>
      ) : null}
      {usedAt ? (
        <p className="text-sm text-amber-800">
          Erteleme hakkı {formatLongDate(usedAt)} tarihinde kullanıldı.
        </p>
      ) : null}
    </Card>
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
