"use client";

import { Button, Card } from "@/components/ui";
import { STUDIO_NAME } from "@/lib/studio";
import Link from "next/link";
import { useState } from "react";

export default function SifremiUnuttumPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/student/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(data?.error ?? "İstek gönderilemedi.");
        return;
      }
      setSent(true);
    } catch {
      setError("İstek gönderilemedi. Biraz sonra tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/giris" className="mb-5 block text-center">
          <p className="font-serif text-3xl">{STUDIO_NAME}</p>
        </Link>

        <Card className="p-6">
          {sent ? (
            <div className="space-y-4">
              <h1 className="font-serif text-2xl">Mail gönderildi</h1>
              <p className="text-sm text-muted">
                <span className="font-medium text-foreground">{email.trim()}</span>{" "}
                adresine kayıtlı bir hesap varsa şifre sıfırlama bağlantısı
                gönderildi. Gelen kutunu ve spam klasörünü kontrol et.
              </p>
              <Link
                href="/giris"
                className="block text-center text-sm font-medium text-accent"
              >
                Girişe dön
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h1 className="font-serif text-2xl">Şifremi unuttum</h1>
                <p className="mt-2 text-sm text-muted">
                  Öğrenci veya eğitmen e-postanı yaz; sıfırlama bağlantısı
                  mailine gelecek.
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
              {error ? <p className="text-sm text-red-700">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
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
