"use client";

import { useStudio } from "@/components/studio-provider";
import type { Role } from "@/types/studio";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RoleGuard({
  role,
  children,
}: {
  role: Role;
  children: React.ReactNode;
}) {
  const { ready, user } = useStudio();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(role === "student" ? "/giris?rol=ogrenci" : "/giris?rol=admin");
      return;
    }
    if (user.role !== role) {
      router.replace(user.role === "admin" ? "/admin" : "/ogrenci");
    }
  }, [ready, role, router, user]);

  if (!ready || !user || user.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Yükleniyor…
      </div>
    );
  }

  return children;
}
