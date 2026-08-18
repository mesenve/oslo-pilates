"use client";

import { Button, Card, SessionBadge } from "@/components/ui";
import { CalendarIcon, ClockIcon } from "@/components/icons";
import {
  formatLongDate,
  isBefore,
  parseISODate,
  startOfWeekMonday,
  toISODate,
  todayISO,
} from "@/lib/dates";
import type { Session } from "@/types/studio";
import { useState } from "react";

export function SessionRow({
  session,
  time,
  onAttend,
  onPostpone,
}: {
  session: Session;
  time: string;
  onAttend: () => void;
  onPostpone: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const currentMonday = toISODate(startOfWeekMonday());
  const sessionMonday = toISODate(startOfWeekMonday(parseISODate(session.date)));
  const isCurrentWeek = sessionMonday === currentMonday;
  const locked =
    session.status !== "upcoming" ||
    (isBefore(session.date, todayISO()) && !isCurrentWeek);

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
          <SessionBadge status={session.status} />
          {!locked ? (
            <>
              <Button onClick={onAttend}>Geldim</Button>
              <Button variant="secondary" onClick={() => setOpen(true)}>
                Ertele
              </Button>
            </>
          ) : null}
        </div>
      </div>

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
            Sadece bu ders ertelenir. Yeni ders için saat seçilmez.
          </p>
          <label className="mt-3 block text-sm text-muted" htmlFor={`reason-${session.id}`}>
            Not (isteğe bağlı)
          </label>
          <textarea
            id={`reason-${session.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:border-accent"
            placeholder="Hocaya kısa bir not bırakabilirsin."
          />
          <div className="mt-3 flex gap-2">
            <Button type="submit">Bu dersi ertele</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}
