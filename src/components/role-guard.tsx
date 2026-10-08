"use client";

import { useStudio } from "@/components/studio-provider";
import { Button, Card } from "@/components/ui";
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
  const { ready, sessionChecked, user, students, studioDataStatus, retryStudioData, logout } = useStudio();
  const router = useRouter();
  const hadUser = useRef(false);

  useEffect(() => {
    if (!ready || !sessionChecked) return;
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
  }, [ready, role, router, sessionChecked, user]);

  if (!ready || !sessionChecked || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Yükleniyor…
      </div>
    );
  }

  // Without this, a failed load or an archived account leaves "Programın yükleniyor…" forever.
  if (
    role === "student" &&
    studioDataStatus !== "loading" &&
    !students.some((student) => student.id === user.id)
  ) {
    const failed = studioDataStatus === "error";
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-sm space-y-3 p-5 text-center">
          <p className="font-serif text-xl">
            {failed ? "Programın yüklenemedi" : "Hesabın aktif görünmüyor"}
          </p>
          <p className="text-sm text-muted">
            {failed
              ? "Bağlantında ya da sunucuda geçici bir sorun var. Tekrar dene."
              : "Kaydına ulaşamadık. Detay için stüdyoyla iletişime geç."}
          </p>
          <div className="flex justify-center gap-2">
            {failed ? <Button onClick={() => void retryStudioData()}>Tekrar dene</Button> : null}
            <Button
              variant="secondary"
              onClick={() => {
                logout();
                router.replace("/giris?rol=ogrenci");
              }}
            >
              Çıkış yap
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return children;
}

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { ready, sessionChecked, user } = useStudio();
  const router = useRouter();
  const hadUser = useRef(false);

  useEffect(() => {
    if (!ready || !sessionChecked) return;
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
  }, [ready, router, sessionChecked, user]);

  if (!ready || !sessionChecked || !user || !isStaffRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Yükleniyor…
      </div>
    );
  }

  return children;
}
