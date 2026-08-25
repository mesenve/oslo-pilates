"use client";

import { Button, Card } from "@/components/ui";
import { DEMO_ACCOUNTS } from "@/data/students";
import { STUDIO_NAME } from "@/lib/studio";
import Link from "next/link";
import { useState } from "react";

export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS.student.email);
  const [sent, setSent] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSent(true);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 block text-center">
          <p className="font-serif text-3xl">{STUDIO_NAME}</p>
          <p className="mt-1 text-sm text-muted">Şifre sıfırlama</p>
        </Link>

        <Card className="p-6">
          {sent ? (
            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
                Demo
              </p>
              <h1 className="font-serif text-2xl">Mail gönderildi</h1>
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{email.trim()}</span>{" "}
                adresine şifre yenileme bağlantısı gönderilmiş gibi gösteriyoruz.
                Gerçek mail gitmez.
              </p>
              <Link
                href={`/giris/sifre-yenile?email=${encodeURIComponent(email.trim())}`}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#ec407a] to-accent px-4 py-2.5 text-sm font-medium text-white shadow-[0_8px_20px_rgba(194,24,91,0.28)]"
              >
                Demo: şifreyi yenile
              </Link>
              <Link
                href="/giris"
                className="block text-center text-sm text-muted hover:text-foreground"
              >
                Girişe dön
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="font-serif text-2xl">Şifremi unuttum</h1>
                <p className="mt-2 text-sm text-muted">
                  E-posta adresini yaz; demo olarak sıfırlama adımına
                  geçebilirsin.
                </p>
              </div>
              <div>
                <label className="text-sm text-muted" htmlFor="email">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
                  autoComplete="username"
                />
              </div>
              <Button type="submit" className="w-full">
                Sıfırlama bağlantısı gönder
              </Button>
              <Link
                href="/giris"
                className="block text-center text-sm text-muted hover:text-foreground"
              >
                Girişe dön
              </Link>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
