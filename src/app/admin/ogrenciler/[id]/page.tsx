"use client";

import { ClassCalendar } from "@/components/class-calendar";
import { ChevronLeftIcon, TrashIcon } from "@/components/icons";
import { Button, Card, ConfirmDialog, EmptyState, PaymentBadge, RequestBadge, SessionBadge } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import {
  effectiveSessionStatus,
  remainingPostponeRights,
  sessionCounts,
  sessionsForStudent,
} from "@/data/accessors";
import { getClassGroupById } from "@/data/groups";
import { formatLongDate, todayISO } from "@/lib/dates";
import { remainingLabel, postponeRightAdminLabel } from "@/lib/labels";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const { students, sessions, remainingFor, postponeRequests, approveRequest, archiveStudent } =
    useStudio();
  const router = useRouter();
  const student = students.find((item) => item.id === params.id);
  const mine = sessionsForStudent(student?.id ?? "", sessions);
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
  const counts = sessionCounts(student?.id ?? "", sessions);
  const group = student ? getClassGroupById(student.groupId) : undefined;
  const requests = postponeRequests.filter(
    (request) => request.studentId === student?.id,
  );

  if (!student) {
    return (
      <div className="space-y-4">
        <Link href="/admin/ogrenciler" className="text-sm text-muted">
          ← Öğrenciler
        </Link>
        <EmptyState>Öğrenci bulunamadı.</EmptyState>
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
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
          Öğrenci detayı
        </p>
        <h1 className="mt-1 font-serif text-3xl">{student.name}</h1>
        <p className="mt-1 text-sm text-muted">{group?.label}</p>
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
              remainingPostponeRights(student, postponeRequests),
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
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => setConfirmDelete(true)}
        >
          <TrashIcon className="h-4 w-4" />
          Sil
        </Button>
      </Card>

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
                <p className="text-sm text-amber-800">
                  Bu ders ertelendi. Yeni saat seçilmedi.
                </p>
              ) : null}
              {status === "postpone_pending" ? (
                <p className="text-sm text-amber-800">
                  Erteleme talebi onay bekliyor. Yeni saat seçilmedi.
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
            const session = sessions.find((item) => item.id === request.sessionId);
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
                <p className="text-sm text-amber-800">
                  Yeni ders için saat seçilmedi.
                </p>
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
            router.replace("/admin/ogrenciler");
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
