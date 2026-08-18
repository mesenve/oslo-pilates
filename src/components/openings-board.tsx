"use client";

import { WhatsAppIcon } from "@/components/icons";
import { Card } from "@/components/ui";
import { getOpenSlots, groupOpeningsByDate, type OpenSlot } from "@/lib/openings";
import { formatLongDate } from "@/lib/dates";
import { getAvailabilityWhatsAppUrl } from "@/lib/studio";
import type { PostponeRequest, Session } from "@/types/studio";

export function OpeningsBoard({
  requests,
  sessions,
}: {
  requests: PostponeRequest[];
  sessions: Session[];
}) {
  const slots = getOpenSlots(requests, sessions);
  const byDate = groupOpeningsByDate(slots);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            WhatsApp
          </p>
          <h2 className="mt-1 font-serif text-2xl">Müsaitlik duyurusu</h2>
          <p className="mt-1 text-sm text-muted">
            Onaylanan ertelemeler boşluk açar. Karta tıklayınca duyuru gider.
          </p>
        </div>
        {slots.length > 0 ? (
          <a
            href={getAvailabilityWhatsAppUrl(slots)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-2 text-sm font-medium text-white"
          >
            <WhatsAppIcon className="h-4 w-4" />
            Tümünü duyur
          </a>
        ) : null}
      </div>

      {byDate.length === 0 ? (
        <p className="text-sm text-muted">
          Onaylı erteleme yok. Talep onaylanınca burada boşluk oluşur.
        </p>
      ) : (
        byDate.map(([date, daySlots]) => (
          <Card key={date} className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="font-serif text-xl capitalize">
                {formatLongDate(date)}
              </p>
              <a
                href={getAvailabilityWhatsAppUrl(daySlots)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-accent"
              >
                Günü duyur
              </a>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {daySlots.map((slot) => (
                <OpeningCard key={`${slot.groupId}-${slot.time}`} slot={slot} />
              ))}
            </div>
          </Card>
        ))
      )}
    </section>
  );
}

function OpeningCard({ slot }: { slot: OpenSlot }) {
  return (
    <a
      href={getAvailabilityWhatsAppUrl([slot])}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-white px-4 py-3 hover:border-accent hover:bg-accent-soft/40"
    >
      <div>
        <p className="font-medium">
          {slot.time} {slot.spots} kişilik
        </p>
        <p className="text-xs text-muted">{slot.groupLabel}</p>
      </div>
      <WhatsAppIcon className="h-5 w-5 text-[#25d366]" />
    </a>
  );
}
