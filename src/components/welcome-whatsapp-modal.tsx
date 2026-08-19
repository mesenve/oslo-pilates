"use client";

import { CloseIcon, WhatsAppIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { getWelcomeWhatsAppUrl, WELCOME_WHATSAPP_TEXT } from "@/lib/studio";

export function WelcomeWhatsAppModal({
  studentName,
  phone,
  onClose,
}: {
  studentName: string;
  phone: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onClose}
        className="absolute inset-0 bg-[#2b1a22]/35 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-sm rounded-3xl border border-white/80 bg-white p-5 shadow-[0_18px_40px_rgba(194,24,91,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              WhatsApp
            </p>
            <p className="mt-1 font-serif text-2xl">Bilgilendirme</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">
          Hoş geldin mesajını WhatsApp’tan gönderebilirsin.
        </p>
        <p className="mt-3 rounded-2xl bg-surface-muted px-3 py-3 text-sm">
          {WELCOME_WHATSAPP_TEXT}
        </p>
        <a
          href={getWelcomeWhatsAppUrl(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25d366] px-4 py-3 text-center text-sm font-medium text-white"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Kayıtlı öğrenciye WhatsApp bilgilendirme mesajı gönder
        </a>
        <Button variant="ghost" className="mt-2 w-full" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </div>
  );
}
