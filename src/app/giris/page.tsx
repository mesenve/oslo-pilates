"use client";

import { Button, Card } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { DEMO_ACCOUNTS } from "@/data/students";
import { getInstructors } from "@/data/staff";
import { adminHomeFor } from "@/lib/access";
import { STUDIO_NAME } from "@/lib/studio";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Role, StaffRole } from "@/types/studio";

type PortalRole = "student" | "staff";
type StaffChoice = StaffRole | "staff-elif" | "staff-delfin";

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
  const initialPortal: PortalRole =
    searchParams.get("rol") === "admin" ? "staff" : "student";
  const [portal, setPortal] = useState<PortalRole>(initialPortal);
  const [staffChoice, setStaffChoice] = useState<StaffChoice>("super_admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const nextPortal: PortalRole =
      searchParams.get("rol") === "admin" ? "staff" : "student";
    setPortal(nextPortal);
    applyAccount(nextPortal, staffChoice);
  }, [searchParams]);

  useEffect(() => {
    applyAccount(portal, staffChoice);
  }, [portal, staffChoice]);

  useEffect(() => {
    if (!ready || !user) return;
    if (portal === "student" && user.role === "student") {
      router.replace("/ogrenci");
      return;
    }
    if (portal === "staff" && (user.role === "super_admin" || user.role === "instructor")) {
      router.replace(adminHomeFor(user));
    }
  }, [portal, ready, router, user]);

  function applyAccount(nextPortal: PortalRole, nextStaff: StaffChoice) {
    if (nextPortal === "student") {
      setEmail(DEMO_ACCOUNTS.student.email);
      setPassword(DEMO_ACCOUNTS.student.password);
      return;
    }
    if (nextStaff === "super_admin") {
      setEmail(DEMO_ACCOUNTS.super_admin.email);
      setPassword(DEMO_ACCOUNTS.super_admin.password);
      return;
    }
    if (nextStaff === "staff-elif") {
      setEmail(DEMO_ACCOUNTS.instructor_elif.email);
      setPassword(DEMO_ACCOUNTS.instructor_elif.password);
      return;
    }
    setEmail(DEMO_ACCOUNTS.instructor_delfin.email);
    setPassword(DEMO_ACCOUNTS.instructor_delfin.password);
  }

  function switchPortal(next: PortalRole) {
    setPortal(next);
    if (next === "student") {
      applyAccount("student", staffChoice);
    } else {
      applyAccount("staff", staffChoice);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (portal === "student") {
      loginAs("student");
      router.replace("/ogrenci");
      return;
    }
    if (staffChoice === "super_admin") {
      loginAs("super_admin", "staff-ece");
    } else if (staffChoice === "staff-elif") {
      loginAs("instructor", "staff-elif");
    } else {
      loginAs("instructor", "staff-delfin");
    }
    router.replace("/admin");
  }

  const cat =
    portal === "staff"
      ? { src: "/kediler/hoca.png", alt: "Admin girişi kedisi" }
      : { src: "/kediler/ogrenci.png", alt: "Pilates öğrencisi kedi" };

  const instructors = getInstructors();

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
              onClick={() => switchPortal("student")}
              className={`rounded-full px-3 py-2 text-sm ${
                portal === "student" ? "bg-white text-accent shadow-sm" : "text-muted"
              }`}
            >
              Öğrenci
            </button>
            <button
              type="button"
              onClick={() => switchPortal("staff")}
              className={`rounded-full px-3 py-2 text-sm ${
                portal === "staff" ? "bg-white text-accent shadow-sm" : "text-muted"
              }`}
            >
              Admin
            </button>
          </div>

          {portal === "staff" ? (
            <div className="mb-5 space-y-3">
              <p className="text-sm text-muted">Admin türü</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setStaffChoice("super_admin")}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm ${
                    staffChoice === "super_admin"
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-white text-muted"
                  }`}
                >
                  <span className="block font-medium text-foreground">Süper admin</span>
                  <span className="mt-0.5 block text-xs">Ece · tüm stüdyo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStaffChoice("staff-elif")}
                  className={`rounded-2xl border px-3 py-3 text-left text-sm ${
                    staffChoice === "staff-elif" || staffChoice === "staff-delfin"
                      ? "border-accent bg-accent-soft text-accent"
                      : "border-border bg-white text-muted"
                  }`}
                >
                  <span className="block font-medium text-foreground">Eğitmen</span>
                  <span className="mt-0.5 block text-xs">Elif & Delfin</span>
                </button>
              </div>
              {staffChoice !== "super_admin" ? (
                <div className="grid grid-cols-2 gap-2">
                  {instructors.map((instructor) => (
                    <button
                      key={instructor.id}
                      type="button"
                      onClick={() =>
                        setStaffChoice(
                          instructor.id as "staff-elif" | "staff-delfin",
                        )
                      }
                      className={`rounded-full px-3 py-2 text-sm ${
                        staffChoice === instructor.id
                          ? "bg-white text-accent shadow-sm ring-1 ring-accent/30"
                          : "bg-surface-muted text-muted"
                      }`}
                    >
                      {instructor.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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
              <div className="mt-2 text-right">
                <Link
                  href="/giris/sifremi-unuttum"
                  className="text-sm text-accent hover:text-accent-hover"
                >
                  Şifremi unuttum
                </Link>
              </div>
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
