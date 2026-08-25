"use client";

import { useStudio } from "@/components/studio-provider";
import { adminHomeFor, isStaffRole } from "@/lib/access";
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
      router.replace(adminHomeFor(user));
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

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { ready, user } = useStudio();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace("/giris?rol=admin");
      return;
    }
    if (!isStaffRole(user.role)) {
      router.replace("/ogrenci");
    }
  }, [ready, router, user]);

  if (!ready || !user || !isStaffRole(user.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Yükleniyor…
      </div>
    );
  }

  return children;
}
