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
import { PACKAGE_TYPE_LABELS } from "@/data/packages";
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
  "package.endDate": "Paket bitiş tarihi değişikliği",
  "package.totalSessions": "Paket değişikliği",
  packageType: "Paket türü değişikliği",
  "package.paymentStatus": "Ödeme durumu değişikliği",
  "package.customSchedule": "Özel program değişikliği",
  monthlyPostponeLimit: "Erteleme hakkı değişikliği",
  note: "Not değişikliği",
  measurements: "Ölçü bilgisi değişikliği",
};

function readableChangeValue(field: string, value: string) {
  if (field === "groupId") return getClassGroupById(value)?.label ?? value;
  if (field === "packageType") {
    return PACKAGE_TYPE_LABELS[value as keyof typeof PACKAGE_TYPE_LABELS] ?? value;
  }
  if (field === "package.paymentStatus") return value === "paid" ? "Ödendi" : "Ödenmedi";
  if (field === "monthlyPostponeLimit") return `${value} ders`;
  return value;
}

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
    setPostponeLessonNote,
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
  const [actionError, setActionError] = useState<string | null>(null);
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
  const studentRequests = visiblePostponeRequests
    .filter((request) => request.studentId === student?.id)
    .sort((a, b) => {
      const aActive = a.status === "pending" || a.status === "approved";
      const bActive = b.status === "pending" || b.status === "approved";
      if (aActive !== bActive) return aActive ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .filter(
      (request, index, all) =>
        all.findIndex((item) => item.sessionId === request.sessionId) === index,
    );
  // Paket başına tek erteleme kartı: bekleyen varsa o, yoksa en güncel onaylı.
  const postponeCard =
    studentRequests.find((request) => request.status === "pending") ??
    studentRequests.find((request) => request.status === "approved") ??
    null;
  const postponeCardSession = postponeCard
    ? visibleSessions.find((item) => item.id === postponeCard.sessionId)
    : undefined;

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
          {student.renewalRequest.status === "approved" && student.renewalRequest.startDate && student.renewalRequest.startDate > student.package.startDate ? (
            <p className="text-sm">Yeni paket {formatLongDate(student.renewalRequest.startDate)} tarihinde başlayacak.</p>
          ) : null}
          {student.renewalRequest.status === "pending" ? (
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setActionError(null);
                  void reviewRenewal(student.id, "approved").then((result) => {
                    if (result.error) setActionError(result.error);
                  });
                }}
              >
                Talebi kabul et
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  setActionError(null);
                  void reviewRenewal(student.id, "rejected").then((result) => {
                    if (result.error) setActionError(result.error);
                  });
                }}
              >
                Reddet
              </Button>
            </div>
          ) : null}
          {actionError && student.renewalRequest.status === "pending" ? (
            <p className="text-sm text-red-700">{actionError}</p>
          ) : null}
        </Card>
      ) : null}

      {student.changeLog?.length ? (
        <Card className="p-4">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl text-left [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-serif text-xl">Değişiklik günlüğü</span>
                <span className="mt-1 block text-xs text-muted">
                  Son {Math.min(student.changeLog.length, 8)} kayıt
                </span>
              </span>
              <ChevronDownIcon className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
              {student.changeLog.slice(0, 8).map((entry) => (
                <p key={entry.id} className="text-sm text-muted">
                  {formatLongDate(entry.createdAt.slice(0, 10))} · {getStaffById(entry.actorId)?.name ?? entry.actorId} · {CHANGE_FIELD_LABELS[entry.field] ?? "Bilgi değişikliği"}: {readableChangeValue(entry.field, entry.before) || "—"} → {readableChangeValue(entry.field, entry.after) || "—"}
                </p>
              ))}
            </div>
          </details>
        </Card>
      ) : null}

      {student.packageHistory?.length ? (
        <Card className="p-4">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl text-left [&::-webkit-details-marker]:hidden">
              <span>
                <span className="block font-serif text-xl">Paket geçmişi</span>
                <span className="mt-1 block text-xs text-muted">
                  {student.packageHistory.length} eski paket kaydı
                </span>
              </span>
              <ChevronDownIcon className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
              <p className="mb-3 text-xs text-muted">
                Önceki paket dönemleri saklanır; mevcut paket düzenlenirken silinmez.
              </p>
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
          </details>
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
                const data = (await response.json().catch(() => null)) as {
                  error?: string;
                } | null;
                if (!response.ok) {
                  throw new Error(
                    data?.error ?? "Şifre sıfırlama maili gönderilemedi.",
                  );
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
                    setResendError(null);
                    window.setTimeout(() => setCopiedInvite(false), 2000);
                  } catch (error) {
                    setCopiedInvite(false);
                    setResendStatus("error");
                    setResendError(
                      error instanceof Error
                        ? error.message
                        : "Davet linki kaydedilemedi / kopyalanamadı.",
                    );
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
                    const data = (await response.json().catch(() => null)) as {
                      error?: string;
                    } | null;
                    if (!response.ok) {
                      throw new Error(data?.error ?? "Mail gönderilemedi.");
                    }
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
          const request = studentRequests.find(
            (item) => item.sessionId === session.id,
          );
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
        <Card className="space-y-3 p-4">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted">
              Paket erteleme hakkı
            </p>
            <p className="mt-1 text-sm">
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
          </div>
          <PostponeUsedFields
            used={student.postponeLessonUsed ?? false}
            usedAt={
              postponeUsedDateInPackage(
                student,
                visiblePostponeRequests,
                visibleSessions,
              ) ?? student.postponeLessonUsedAt ?? ""
            }
            onChange={(used, usedAt) =>
              setPostponeLessonUsed(student.id, used, usedAt)
            }
          />
          {!postponeCard ? (
            <PostponeNoteEditor
              key={`${student.id}:${student.postponeLessonNote ?? ""}`}
              initialNote={student.postponeLessonNote ?? ""}
              onSave={(note) => setPostponeLessonNote(student.id, note)}
            />
          ) : null}
        </Card>

        {!postponeCard ? (
          <EmptyState>Bu öğrencinin erteleme kaydı yok.</EmptyState>
        ) : (
          <Card className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="capitalize">
                {postponeCardSession
                  ? formatLongDate(postponeCardSession.date)
                  : "Ders bulunamadı"}
              </p>
              <RequestBadge status={postponeCard.status} />
            </div>
            {lessonTime ? <p className="text-sm text-muted">{lessonTime}</p> : null}
            <PostponeNoteEditor
              key={`${postponeCard.id}:${postponeCard.reason ?? ""}`}
              initialNote={postponeCard.reason ?? ""}
              lessonLabel={
                postponeCardSession
                  ? formatLongDate(postponeCardSession.date)
                  : null
              }
              onSave={(reason) => setPostponeRequestReason(postponeCard.id, reason)}
            />
            {postponeCard.status === "pending" ? (
              <Button
                disabled={approvingId === postponeCard.id}
                onClick={() => {
                  if (approvingId) return;
                  setActionError(null);
                  setApprovingId(postponeCard.id);
                  void approveRequest(postponeCard.id)
                    .then((ok) => {
                      if (!ok) setActionError("Talep onaylanamadı. Tekrar dene.");
                    })
                    .catch(() => {
                      setActionError("Talep onaylanamadı. Tekrar dene.");
                    })
                    .finally(() => setApprovingId(null));
                }}
              >
                {approvingId === postponeCard.id ? "Onaylanıyor…" : "Onayla"}
              </Button>
            ) : null}
            {postponeCard.actedAt ? (
              <p className="text-xs text-muted">
                İşlemi yapan:{" "}
                {getStaffById(postponeCard.actedBy ?? "")?.name ??
                  postponeCard.actedBy ??
                  "—"}
              </p>
            ) : null}
          </Card>
        )}
      </section>

      {actionError ? <p className="text-sm text-red-700">{actionError}</p> : null}

      <section className="space-y-3">
        <h2 className="font-serif text-xl">Tüm dersler</h2>
        {mine.map((session) => {
          const status = effectiveSessionStatus(session);
          const pickerStatus =
            status === "attend_pending"
              ? "attended"
              : status === "postpone_pending"
                ? "postponed"
                : status === "upcoming" ||
                    status === "attended" ||
                    status === "postponed" ||
                    status === "missed"
                  ? status
                  : "upcoming";
          const futureOnly =
            session.date > today &&
            (pickerStatus === "upcoming" || pickerStatus === "postponed");
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
              <AttendanceStatusPicker
                status={pickerStatus}
                futureOnly={futureOnly}
                onChange={(nextStatus) => {
                  setActionError(null);
                  void markSessionByInstructor(session.id, nextStatus).then((ok) => {
                    if (!ok) {
                      setActionError("Ders durumu güncellenemedi. Tekrar dene.");
                    }
                  });
                }}
              />
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
  futureOnly = false,
  onChange,
}: {
  status: "upcoming" | "attended" | "postponed" | "missed";
  futureOnly?: boolean;
  onChange: (status: "upcoming" | "attended" | "postponed" | "missed") => void;
}) {
  const [open, setOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const allOptions: Array<{
    value: "upcoming" | "attended" | "postponed" | "missed";
    label: string;
    className: string;
  }> = [
    {
      value: "upcoming",
      label: "Bekleniyor",
      className: "border-amber-100 bg-amber-50 text-amber-800",
    },
    {
      value: "attended",
      label: "Geldi",
      className: "border-emerald-100 bg-emerald-50 text-emerald-800",
    },
    {
      value: "postponed",
      label: "Ertelendi",
      className: "border-red-100 bg-red-50 text-red-700",
    },
    {
      value: "missed",
      label: "Yandı",
      className: "border-red-100 bg-red-50 text-red-700",
    },
  ];
  const options = futureOnly
    ? allOptions.filter(
        (option) => option.value === "upcoming" || option.value === "postponed",
      )
    : allOptions;
  const current =
    options.find((option) => option.value === status) ??
    allOptions.find((option) => option.value === status) ??
    options[0];

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

function PostponeNoteEditor({
  initialNote,
  lessonLabel,
  onSave,
}: {
  initialNote: string;
  lessonLabel?: string | null;
  onSave: (reason: string) => Promise<boolean>;
}) {
  const [noteDraft, setNoteDraft] = useState(initialNote);
  const [savingNote, setSavingNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteDirty = noteDraft.trim() !== (initialNote ?? "").trim();
  const noteSaved = Boolean(initialNote.trim()) && !noteDirty;

  return (
    <div className="space-y-2">
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-[0.16em] text-muted">
          Erteleme notu
        </span>
        <textarea
          value={noteDraft}
          rows={2}
          placeholder="Öğrencinin göreceği erteleme notu…"
          className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
          onChange={(event) => setNoteDraft(event.target.value)}
        />
      </label>
      {lessonLabel ? (
        <p className="text-xs text-muted">
          Öğrenci bu notu {lessonLabel} dersinde görür.
        </p>
      ) : null}
      <Button
        disabled={savingNote || !noteDirty}
        onClick={() => {
          if (savingNote || !noteDirty) return;
          setError(null);
          setSavingNote(true);
          void onSave(noteDraft)
            .then((ok) => {
              if (!ok) setError("Not kaydedilemedi. Tekrar dene.");
            })
            .catch(() => {
              setError("Not kaydedilemedi. Tekrar dene.");
            })
            .finally(() => setSavingNote(false));
        }}
      >
        {savingNote ? (
          "Kaydediliyor…"
        ) : noteSaved ? (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <CheckIcon className="h-4 w-4" />
            Not kaydedildi
          </span>
        ) : (
          "Notu Kaydet"
        )}
      </Button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

function PostponeUsedFields({
  used,
  usedAt,
  onChange,
}: {
  used: boolean;
  usedAt: string;
  onChange: (used: boolean, usedAt?: string) => Promise<boolean>;
}) {
  const [dateValue, setDateValue] = useState(usedAt || todayISO());
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={used}
          onChange={(event) => {
            setError(null);
            void onChange(event.target.checked, dateValue || todayISO()).then((ok) => {
              if (!ok) setError("Erteleme hakkı güncellenemedi. Tekrar dene.");
            });
          }}
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
            if (used) {
              setError(null);
              void onChange(true, next).then((ok) => {
                if (!ok) setError("Erteleme hakkı güncellenemedi. Tekrar dene.");
              });
            }
          }}
          className="w-full rounded-2xl border border-border bg-white px-3 py-2 text-sm"
        />
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {usedAt ? (
        <p className="text-sm text-amber-800">
          Erteleme hakkı {formatLongDate(usedAt)} tarihinde kullanıldı.
        </p>
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
