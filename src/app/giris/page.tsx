"use client";

import { Button, Card } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { DEMO_ACCOUNTS } from "@/data/students";
import { STUDIO_NAME } from "@/lib/studio";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Role } from "@/types/studio";

export default function GirisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center text-sm text-muted">
          Yükleniyor…
        </div>
      }
    >
      <GirisForm />
    </Suspense>
  );
}

function GirisForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginAs, user, ready } = useStudio();
  const initialRole: Role =
    searchParams.get("rol") === "admin" ? "admin" : "student";
  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState<string>(accountFor(initialRole).email);
  const [password, setPassword] = useState<string>(
    accountFor(initialRole).password,
  );

  useEffect(() => {
    const nextRole: Role =
      searchParams.get("rol") === "admin" ? "admin" : "student";
    setRole(nextRole);
    setEmail(accountFor(nextRole).email);
    setPassword(accountFor(nextRole).password);
  }, [searchParams]);

  useEffect(() => {
    if (!ready) return;
    if (user && user.role === role) {
      router.replace(role === "admin" ? "/admin" : "/ogrenci");
    }
  }, [ready, role, router, user]);

  function switchRole(next: Role) {
    setRole(next);
    setEmail(accountFor(next).email);
    setPassword(accountFor(next).password);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    loginAs(role);
    router.replace(role === "admin" ? "/admin" : "/ogrenci");
  }

  const cat =
    role === "admin"
      ? { src: "/kediler/hoca.png", alt: "Admin girişi kedisi" }
      : { src: "/kediler/ogrenci.png", alt: "Pilates öğrencisi kedi" };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-5 block text-center">
          <p className="font-serif text-3xl">{STUDIO_NAME}</p>
          <p className="mt-1 text-sm text-muted">Hesabınla panele gir</p>
        </Link>

        <Card className="h-fit p-6">
          <Image
            src={cat.src}
            alt={cat.alt}
            width={1024}
            height={1024}
            className="mx-auto mb-4 h-40 w-auto object-contain"
            priority
          />

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => switchRole("student")}
              className={`rounded-full px-3 py-2 text-sm ${
                role === "student" ? "bg-white text-accent shadow-sm" : "text-muted"
              }`}
            >
              Öğrenci
            </button>
            <button
              type="button"
              onClick={() => switchRole("admin")}
              className={`rounded-full px-3 py-2 text-sm ${
                role === "admin" ? "bg-white text-accent shadow-sm" : "text-muted"
              }`}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted" htmlFor="email">
                E-posta
              </label>
              <input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
                autoComplete="username"
              />
            </div>
            <div>
              <label className="text-sm text-muted" htmlFor="password">
                Şifre
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm outline-none focus:border-accent"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Giriş yap
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

function accountFor(role: Role) {
  return role === "admin" ? DEMO_ACCOUNTS.admin : DEMO_ACCOUNTS.student;
}
