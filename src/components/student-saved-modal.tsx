"use client";

import { CloseIcon, WhatsAppIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { sendInviteEmail } from "@/lib/invite-client";
import { getWelcomeWhatsAppUrl } from "@/lib/studio";
import type { Session, Student } from "@/types/studio";
import { useEffect, useState } from "react";

type MailStatus = "sending" | "sent" | "error";

export function StudentSavedModal({
  student,
  sessions,
  inviteUrl,
  phone,
  onContinue,
}: {
  student: Student;
  sessions: Session[];
  inviteUrl: string;
  phone: string;
  onContinue: () => void;
}) {
  const [mailStatus, setMailStatus] = useState<MailStatus>("sending");
  const [mailError, setMailError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function deliverInvite() {
      setMailStatus("sending");
      setMailError(null);
      try {
        await sendInviteEmail({
          name: student.name,
          email: student.email,
          inviteUrl,
          student,
          sessions,
          expiresAt: student.inviteExpiresAt ?? new Date().toISOString(),
        });
        if (!cancelled) setMailStatus("sent");
      } catch (error) {
        if (!cancelled) {
          setMailStatus("error");
          setMailError(
            error instanceof Error ? error.message : "Davet maili gönderilemedi.",
          );
        }
      }
    }

    void deliverInvite();
    return () => {
      cancelled = true;
    };
  }, [student, sessions, inviteUrl]);

  async function retryMail() {
    setMailStatus("sending");
    setMailError(null);
    try {
      await sendInviteEmail({
        name: student.name,
        email: student.email,
        inviteUrl,
        student,
        sessions,
        expiresAt: student.inviteExpiresAt ?? new Date().toISOString(),
      });
      setMailStatus("sent");
    } catch (error) {
      setMailStatus("error");
      setMailError(
        error instanceof Error ? error.message : "Davet maili gönderilemedi.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-5">
      <button
        type="button"
        aria-label="Kapat"
        onClick={onContinue}
        className="absolute inset-0 bg-[#2b1a22]/35 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-sm rounded-3xl border border-white/80 bg-white p-5 shadow-[0_18px_40px_rgba(194,24,91,0.18)]"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="font-serif text-2xl">Kayıt tamam</p>
          <button
            type="button"
            onClick={onContinue}
            aria-label="Kapat"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-foreground"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {mailStatus === "sending" ? (
          <p className="mt-2 text-sm text-muted">
            Davet maili{" "}
            <span className="font-medium text-foreground">{student.email}</span> adresine
            gönderiliyor…
          </p>
        ) : mailStatus === "sent" ? (
          <p className="mt-2 text-sm text-muted">
            Davet maili{" "}
            <span className="font-medium text-foreground">{student.email}</span> adresine
            gönderildi.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-red-700">Davet maili gönderilemedi.</p>
            {mailError ? <p className="text-sm text-muted">{mailError}</p> : null}
            <Button type="button" variant="secondary" className="w-full" onClick={retryMail}>
              Maili tekrar gönder
            </Button>
          </div>
        )}

        <a
          href={getWelcomeWhatsAppUrl(phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25d366] px-4 py-3 text-center text-sm font-medium text-white"
        >
          <WhatsAppIcon className="h-4 w-4" />
          WhatsApp ile bilgilendir
        </a>
      </div>
    </div>
  );
}
