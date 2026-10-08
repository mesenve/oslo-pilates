"use client";

import { useStudio } from "@/components/studio-provider";
import { adminHomeFor, isStaffRole } from "@/lib/access";
import type { Role } from "@/types/studio";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const SESSION_GRACE_MS = 2000;

export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { ready, sessionChecked, sessionError, user } = useStudio();
  const router = useRouter();
  const hadUser = useRef(false);

  useEffect(() => {
    if (!ready || !sessionChecked || sessionError) return;
    if (user) {
      hadUser.current = true;
      if (user.role !== role) {
        router.replace(adminHomeFor(user));
      }
      return;
    }
    if (!hadUser.current) {
      router.replace(role === "student" ? "/giris?rol=ogrenci" : "/giris?rol=admin");
      return;
    }
    const timer = window.setTimeout(() => {
      router.replace(role === "student" ? "/giris?rol=ogrenci" : "/giris?rol=admin");
    }, SESSION_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [ready, role, router, sessionChecked, sessionError, user]);

  if (sessionError) return <SessionRetry />;

  if (!ready || !sessionChecked || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Yükleniyor…
      </div>
    );
  }

  return children;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { ready, sessionChecked, sessionError, user } = useStudio();
  const router = useRouter();
  const hadUser = useRef(false);

  useEffect(() => {
    if (!ready || !sessionChecked || sessionError) return;
    if (user) {
      hadUser.current = true;
      if (!isStaffRole(user.role)) {
        router.replace("/ogrenci");
      }
      return;
    }
    if (!hadUser.current) {
      router.replace("/giris?rol=admin");
      return;
    }
    const timer = window.setTimeout(() => {
      router.replace("/giris?rol=admin");
    }, SESSION_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [ready, router, sessionChecked, sessionError, user]);

  if (sessionError) return <SessionRetry />;

  if (!ready || !sessionChecked || !user || !isStaffRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Yükleniyor…
      </div>
    );
  }

  return children;
}
function SessionRetry() {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center text-sm text-muted">
    <p>Oturumunuz şu anda doğrulanamıyor. Bağlantınızı kontrol edip tekrar deneyin.</p>
    <button className="rounded-full bg-accent px-5 py-2 text-white" onClick={() => window.location.reload()}>
      Tekrar dene
    </button>
  </div>;
}
