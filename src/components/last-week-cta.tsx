"use client";

import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui";
import { formatLongDate, todayISO } from "@/lib/dates";
import type { Student } from "@/types/studio";
import { useState } from "react";

export function LastWeekCta({
  student,
  remaining,
  onRequestRenewal,
}: {
  student: Student;
  remaining: number;
  onRequestRenewal: (date?: string) => Promise<{ error: string | null }>;
}) {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const request = student.renewalRequest;
  const pending = request?.status === "pending";
  const scheduledStart =
    request?.status === "approved" &&
    request.startDate &&
    request.startDate > student.package.startDate
      ? request.startDate
      : null;
  const stuckScheduled = Boolean(scheduledStart && scheduledStart <= todayISO());

  async function submit() {
    setStatus("sending");
    setError(null);
    const result = await onRequestRenewal(date || undefined);
    if (result.error) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setStatus("sent");
  }

  return (
    <section className="flex h-full flex-col rounded-3xl bg-gradient-to-br from-[#ad1457] to-[#880e4f] px-4 py-3.5 text-white shadow-[0_8px_20px_rgba(136,14,79,0.24)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
        Paket hatırlatması
      </p>
      <h2 className="mt-1 font-serif text-lg leading-snug">
        Paketinizde {Math.max(0, remaining)} ders kaldı.
      </h2>
      <p className="mt-1 text-xs text-white/80">
        Ders programınızın kesintisiz devamı için yenileme talebinizi iletmek ister misiniz?
      </p>
      {pending || (status === "sent" && !stuckScheduled) ? (
        <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm">
          Yenileme talebiniz öğretmeninize iletildi.
        </p>
      ) : stuckScheduled ? (
        <div className="mt-3 space-y-3">
          <p className="rounded-xl bg-white/15 px-3 py-2 text-sm">
            Yenilemeniz onaylandı ama yeni paket henüz başlamadı. Tekrar deneyin; olmazsa
            stüdyoyla iletişime geçin.
          </p>
          <Button
            className="self-start bg-white text-accent hover:bg-white/90"
            onClick={() => void submit()}
            disabled={status === "sending"}
          >
            {status === "sending" ? "Deneniyor…" : "Yenilemeyi tekrar dene"}
          </Button>
          {error ? <p className="text-xs text-white">{error}</p> : null}
        </div>
      ) : scheduledStart ? (
        <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm">
          Yenileme talebiniz onaylandı. Yeni paketiniz {formatLongDate(scheduledStart)} tarihinde
          başlıyor.
        </p>
      ) : (
        <>
          {request?.status === "rejected" ? (
            <p className="mt-3 rounded-xl bg-white/15 px-3 py-2 text-sm">
              Son yenileme talebiniz onaylanmadı. Detay için stüdyoyla iletişime geçebilir veya
              yeniden talep gönderebilirsiniz.
            </p>
          ) : null}
          <div className="mt-3 rounded-2xl bg-white/10 p-2">
            <DateField
              label="Tercih edilen başlangıç tarihi (isteğe bağlı)"
              value={date}
              onChange={setDate}
            />
          </div>
          <Button
            className="mt-3 self-start bg-white text-accent hover:bg-white/90"
            onClick={() => void submit()}
            disabled={status === "sending"}
          >
            {status === "sending" ? "Gönderiliyor…" : "Yenileme talebi gönder"}
          </Button>
          {error ? <p className="mt-2 text-xs text-white">{error}</p> : null}
        </>
      )}
    </section>
  );
}
