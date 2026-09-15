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
  time,
  canPostpone,
  canAttend,
  postponeHint,
  onAttend,
  onPostpone,
  onWithdrawPostpone,
}: {
  session: Session;
  time: string;
  canPostpone: boolean;
  canAttend: boolean;
  postponeHint: string;
  onAttend: () => void;
  onPostpone: (reason: string) => void;
  onWithdrawPostpone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const locked = session.status !== "upcoming" || isBefore(session.date, todayISO());

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
          {session.status !== "upcoming" ? <SessionBadge status={session.status} /> : null}
          {session.status === "attend_pending" ||
          session.status === "postpone_pending" ? (
            <p className="text-xs text-muted">Hocanın onayı bekleniyor.</p>
          ) : null}
          {session.status === "postpone_pending" && onWithdrawPostpone ? (
            <Button variant="ghost" onClick={onWithdrawPostpone}>
              Erteleme talebini geri al
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

      {open ? (
        <form
          className="mt-4 border-t border-border pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            onPostpone(reason);
            setReason("");
            setOpen(false);
          }}
        >
          <p className="text-sm text-muted">
            {postponeHint} Hoca onaylayınca bu ders ertelenir.
          </p>
          <div className="mt-3 flex gap-2">
            <Button type="submit">Erteleme talebi gönder</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

