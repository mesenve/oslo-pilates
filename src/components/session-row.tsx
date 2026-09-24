"use client";

import { Button, Card, SessionBadge } from "@/components/ui";
import { CalendarIcon, ClockIcon } from "@/components/icons";
import {
  formatLongDate,
  isBefore,
  todayISO,
} from "@/lib/dates";
import type { Session } from "@/types/studio";
import { useState } from "react";

export function SessionRow({
  session,
  hasPendingPostpone = false,
  time,
  canPostpone,
  canAttend,
  postponeHint,
  postponeNote,
  onAttend,
  onPostpone,
  onWithdrawPostpone,
}: {
  session: Session;
  hasPendingPostpone?: boolean;
  time: string;
  canPostpone: boolean;
  canAttend: boolean;
  postponeHint: string;
  postponeNote?: string;
  onAttend: () => void;
  onPostpone: (reason: string) => void | Promise<boolean | void>;
  onWithdrawPostpone?: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const displayStatus = hasPendingPostpone ? "postpone_pending" : session.status;
  const locked = displayStatus !== "upcoming" || isBefore(session.date, todayISO());

  return (
    <Card className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-3 sm:grid-cols-[1.2fr_0.7fr] sm:items-center">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-accent">
              <CalendarIcon />
            </span>
            <span className="capitalize text-foreground">
              {formatLongDate(session.date)}
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-accent">
              <ClockIcon />
            </span>
            <span>{time}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {displayStatus !== "upcoming" ? <SessionBadge status={displayStatus} /> : null}
          {displayStatus === "attend_pending" ||
          displayStatus === "postpone_pending" ? (
            <p className="text-xs text-muted">Hocanın onayı bekleniyor.</p>
          ) : null}
          {hasPendingPostpone && onWithdrawPostpone ? (
            <Button
              variant="ghost"
              disabled={withdrawing}
              onClick={() => {
                if (withdrawing) return;
                setWithdrawing(true);
                void Promise.resolve(onWithdrawPostpone())
                  .catch(() => undefined)
                  .finally(() => setWithdrawing(false));
              }}
            >
              {withdrawing ? "Geri alınıyor…" : "Erteleme talebini geri al"}
            </Button>
          ) : null}
          {!locked ? (
            <>
              {canAttend ? <Button onClick={onAttend}>Geldim</Button> : null}
              {canPostpone ? (
                <Button variant="secondary" onClick={() => setOpen(true)}>
                  Ertele
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {!locked && !canPostpone ? (
        <p className="mt-3 text-sm text-muted">{postponeHint}</p>
      ) : null}

      {postponeNote?.trim() &&
      (displayStatus === "postponed" || displayStatus === "postpone_pending") ? (
        <p className="mt-3 text-sm">
          <span className="text-muted">Erteleme notu: </span>
          {postponeNote}
        </p>
      ) : null}

      {open ? (
        <form
          className="mt-4 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (submitting) return;
            setSubmitting(true);
            void Promise.resolve(onPostpone(reason))
              .then((ok) => {
                if (ok === false) return;
                setReason("");
                setOpen(false);
              })
              .catch(() => undefined)
              .finally(() => setSubmitting(false));
          }}
        >
          <p className="text-sm text-muted">
            {postponeHint} Hoca onaylayınca bu ders ertelenir.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Gönderiliyor…" : "Erteleme talebi gönder"}
            </Button>
            <Button
              variant="ghost"
              disabled={submitting}
              onClick={() => setOpen(false)}
            >
              Vazgeç
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

