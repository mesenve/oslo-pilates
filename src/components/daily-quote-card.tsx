"use client";

import { getDailyQuote } from "@/lib/daily-quote";
import { todayISO } from "@/lib/dates";

export function DailyQuoteCard({ date = todayISO() }: { date?: string }) {
  const quote = getDailyQuote(date);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-[#fff5f8] to-accent-soft/40 px-5 py-4 shadow-[0_8px_24px_rgba(194,24,91,0.08)]">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-1 -top-3 font-serif text-7xl leading-none text-accent/10"
      >
        “
      </span>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent/80">
        Günün sözü
      </p>
      <p className="relative mt-2 font-serif text-lg leading-snug text-foreground">
        {quote}
      </p>
    </section>
  );
}
