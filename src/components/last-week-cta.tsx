"use client";

import { WhatsAppIcon } from "@/components/icons";
import { getExtensionWhatsAppUrl } from "@/lib/studio";

export function LastWeekCta({ studentName }: { studentName: string }) {
  return (
    <section className="rounded-3xl bg-gradient-to-br from-[#ad1457] to-[#880e4f] px-4 py-3.5 text-white shadow-[0_8px_20px_rgba(136,14,79,0.24)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
        Son hafta
      </p>
      <h2 className="mt-1 font-serif text-lg leading-snug">
        Bu hafta son haftan. Dersi uzatmak ister misin?
      </h2>
      <p className="mt-1 text-xs text-white/80">
        Paketin bitiyor. WhatsApp’tan yazarak uzatabilirsin.
      </p>
      <a
        href={getExtensionWhatsAppUrl(studentName)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-accent"
      >
        <WhatsAppIcon className="h-4 w-4" />
        WhatsApp’tan uzat
      </a>
    </section>
  );
}
