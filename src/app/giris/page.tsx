"use client";

import { PasswordField } from "@/components/form-fields";
import { Button, Card } from "@/components/ui";
import { useStudio } from "@/components/studio-provider";
import { adminHomeFor, isStaffRole } from "@/lib/access";
import { STUDIO_NAME } from "@/lib/studio";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

const REMEMBER_KEY = "oslo-pilates-remember-login";

type PortalRole = "student" | "staff";

type RememberData = {
  remember: boolean;
  studentEmail?: string;
  staffEmail?: string;
};

function readRememberData(): RememberData {
  if (typeof window === "undefined") {
    return { remember: true };
  }
  try {
    const raw = window.localStorage.getItem(REMEMBER_KEY);
    if (!raw) return { remember: true };
    return JSON.parse(raw) as RememberData;
  } catch {
    return { remember: true };
  }
}

function writeRememberData(data: RememberData) {
  window.localStorage.setItem(REMEMBER_KEY, JSON.stringify(data));
}

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
  const { loginStaff, loginStudent, user, ready } = useStudio();
  const initialPortal: PortalRole =
    searchParams.get("rol") === "admin" ? "staff" : "student";
  const [portal, setPortal] = useState<PortalRole>(initialPortal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingLogin, setPendingLogin] = useState(false);

  useEffect(() => {
    const nextPortal: PortalRole =
      searchParams.get("rol") === "admin" ? "staff" : "student";
    setPortal(nextPortal);
  }, [searchParams]);

  useEffect(() => {
    const saved = readRememberData();
    setRememberMe(saved.remember);
    setEmail(
      nextPortalEmail(
        searchParams.get("rol") === "admin" ? "staff" : "student",
        saved,
      ),
    );
    setPassword("");
  }, [searchParams]);

  useEffect(() => {
    const saved = readRememberData();
    setEmail(nextPortalEmail(portal, saved));
    setPassword("");
  }, [portal]);

  useEffect(() => {
    if (!ready || !user) return;

    if (user.role === "student") {
      router.replace("/ogrenci");
      return;
    }
    if (isStaffRole(user.role)) {
      router.replace(adminHomeFor(user));
    }
  }, [ready, router, user]);

  useEffect(() => {
    if (!ready || !user || !pendingLogin) return;

    if (portal === "student") {
      if (user.role === "student") {
        persistRememberChoice(email);
        setPendingLogin(false);
        router.replace("/ogrenci");
        return;
      }
      setPendingLogin(false);
      setError("Öğrenci girişi yapılamadı. Sayfayı yenileyip tekrar dene.");
      return;
    }

    if (user.role === "super_admin" || user.role === "instructor") {
      persistRememberChoice(email);
      setPendingLogin(false);
      router.replace(adminHomeFor(user));
      return;
    }

    setPendingLogin(false);
    setError("Admin girişi yapılamadı. Sayfayı yenileyip tekrar dene.");
  }, [email, pendingLogin, portal, ready, router, user]);

  function nextPortalEmail(nextPortal: PortalRole, saved: RememberData) {
    if (!saved.remember) return "";
    return nextPortal === "student"
      ? (saved.studentEmail ?? "")
      : (saved.staffEmail ?? "");
  }

  function persistRememberChoice(currentEmail: string) {
    if (!rememberMe) {
      writeRememberData({ remember: false });
      return;
    }

    const existing = readRememberData();
    writeRememberData({
      remember: true,
      studentEmail:
        portal === "student" ? currentEmail.trim() : existing.studentEmail,
      staffEmail: portal === "staff" ? currentEmail.trim() : existing.staffEmail,
    });
  }

  function switchPortal(next: PortalRole) {
    setPortal(next);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPendingLogin(true);

    if (portal === "student") {
      const result = await loginStudent(email, password);
      if (result.error) {
        setPendingLogin(false);
        setError(result.error);
      }
      return;
    }

    const result = loginStaff(email, password);
    if (result.error) {
      setPendingLogin(false);
      setError(result.error);
    }
  }

  const illustration =
    portal === "staff"
      ? { src: "/giris/moon.png", alt: "Ay illüstrasyonu" }
      : { src: "/giris/sun.png", alt: "Güneş illüstrasyonu" };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/giris" className="mb-5 block text-center">
          <p className="font-serif text-3xl">{STUDIO_NAME}</p>
        </Link>

        <Card className="h-fit p-6">
          <Image
            src={illustration.src}
            alt={illustration.alt}
            width={1024}
            height={1024}
            className="mx-auto mb-4 h-40 w-auto object-contain"
            priority
          />

          <div className="relative mb-5 grid grid-cols-2 rounded-full bg-surface-muted p-1">
            <span
              aria-hidden
              className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-[0_1px_4px_rgba(194,24,91,0.08)] transition-transform duration-200 ease-out ${
                portal === "staff" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            <button
              type="button"
              onClick={() => switchPortal("student")}
              className={`relative z-10 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                portal === "student" ? "text-accent" : "text-muted"
              }`}
            >
              Öğrenci
            </button>
            <button
              type="button"
              onClick={() => switchPortal("staff")}
              className={`relative z-10 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                portal === "staff" ? "text-accent" : "text-muted"
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
                required
              />
            </div>
            <div>
              <PasswordField
                id="password"
                label="Şifre"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                required
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
            <label className="group flex cursor-pointer items-center gap-2.5 text-sm text-muted has-[:checked]:text-foreground">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-accent/30 bg-accent-soft/40 transition-colors peer-checked:border-transparent peer-checked:bg-gradient-to-br peer-checked:from-[#ec407a] peer-checked:to-accent peer-focus-visible:ring-2 peer-focus-visible:ring-accent/20"
              >
                <svg
                  viewBox="0 0 12 10"
                  fill="none"
                  className={`h-2.5 w-2.5 text-white transition-opacity ${
                    rememberMe ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden
                >
                  <path
                    d="M1 5.5 4.5 9 11 1"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              Beni hatırla
            </label>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={pendingLogin}>
              {pendingLogin ? "Giriş yapılıyor…" : "Giriş yap"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
