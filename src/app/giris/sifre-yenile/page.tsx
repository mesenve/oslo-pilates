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
  const email = searchParams.get("email")?.trim() || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirm) {
      setError("Şifreler eşleşmiyor.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthShell>
        <Card className="p-6">
          <h1 className="font-serif text-2xl">Şifre güncellendi</h1>
          <p className="mt-2 text-sm text-muted">
            Demo akış tamamlandı. Gerçekte şifre kaydedilmez; girişe
            dönebilirsin.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={() => router.replace("/giris")}
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
              {email
                ? `${email} için yeni şifreni yaz.`
                : "Yeni şifreni yaz (demo)."}
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
              className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
              autoComplete="new-password"
            />
          </div>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <Button type="submit" className="w-full">
            Şifreyi kaydet
          </Button>
          <Link
            href="/giris"
            className="block text-center text-sm text-muted hover:text-foreground"
          >
            Girişe dön
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
