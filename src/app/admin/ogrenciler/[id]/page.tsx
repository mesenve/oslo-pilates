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
    archiveStudent,
    resendStudentInvite,
    isSuperAdmin,
  } = useStudio();
  const router = useRouter();
  const student = visibleStudents.find((item) => item.id === params.id);
  const [copiedInvite, setCopiedInvite] = useState(false);
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
                {lessonTime ? <p className="text-sm text-muted">{lessonTime}</p> : null}
                <p className="text-sm">{request.reason}</p>
                {request.status === "pending" ? (
                  <Button onClick={() => approveRequest(request.id)}>Onayla</Button>
                ) : null}
              </Card>
            );
          })
        )}
      </section>

      <Card className="p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={student.postponeLessonUsed ?? false}
            onChange={(event) =>
              setPostponeLessonUsed(student.id, event.target.checked)
            }
            className="peer sr-only"
          />
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-accent/35 bg-accent-soft/30 text-white shadow-[0_3px_10px_rgba(194,24,91,0.1)] transition peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft/70 peer-checked:border-accent peer-checked:bg-accent">
            <CheckIcon className="h-4 w-4 opacity-0 transition peer-checked:opacity-100" />
          </span>
          <span className="text-sm font-medium">Öğrenci erteleme dersini kullandı.</span>
        </label>
      </Card>

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
          onConfirm={() => {
            archiveStudent(student.id);
            router.replace("/admin/arsiv");
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="mt-1 font-serif text-2xl">{value}</p>
    </Card>
  );
}
