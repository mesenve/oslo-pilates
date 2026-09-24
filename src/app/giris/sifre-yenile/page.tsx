"use client";

import { Button, Card } from "@/components/ui";
import { STUDIO_NAME } from "@/lib/studio";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

export default function SifreYenilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
          Yükleniyor…
        </div>
      }
    >
      <SifreYenileForm />
    </Suspense>
  );
}

function SifreYenileForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token")?.trim() || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("Geçersiz sıfırlama linki. Şifremi unuttum sayfasından yeni link iste.");
      return;
    }
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/auth/student/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password,
          confirmPassword: confirm,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setError(data?.error ?? "Şifre kaydedilemedi.");
        return;
      }
      setDone(true);
    } catch {
      setError("Şifre kaydedilemedi. Biraz sonra tekrar dene.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <AuthShell>
        <Card className="p-6">
          <h1 className="font-serif text-2xl">Şifre güncellendi</h1>
          <p className="mt-2 text-sm text-muted">
            Yeni şifren kaydedildi. Şimdi giriş yapabilirsin.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={() => router.replace("/giris?rol=ogrenci")}
          >
            Girişe git
          </Button>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl">Yeni şifre belirle</h1>
            <p className="mt-2 text-sm text-muted">
              {token
                ? "Maildeki linkle geldin. Yeni şifreni yaz."
                : "Geçerli bir sıfırlama linki gerekli."}
            </p>
          </div>
          <div>
            <label className="text-sm text-muted" htmlFor="password">
              Yeni şifre
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={!token}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-sm text-muted" htmlFor="confirm">
              Şifre tekrar
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              disabled={!token}
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending || !token}>
            {pending ? "Kaydediliyor…" : "Şifreyi kaydet"}
          </Button>
          <Link
            href="/giris/sifremi-unuttum"
            className="block text-center text-sm text-muted hover:text-foreground"
          >
            Yeni sıfırlama linki iste
          </Link>
        </form>
      </Card>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/giris" className="mb-5 block text-center">
          <p className="font-serif text-3xl">{STUDIO_NAME}</p>
          <p className="mt-1 text-sm text-muted">Şifre yenileme</p>
        </Link>
        {children}
      </div>
    </div>
  );
}
