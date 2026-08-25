"use client";

import { AppShell, type NavIcon } from "@/components/app-shell";
import { AdminGuard } from "@/components/role-guard";
import { useStudio } from "@/components/studio-provider";
import { canAccessAdminRoute, staffTitle } from "@/lib/access";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

type NavItem = { href: string; label: string; icon: NavIcon };

const SUPER_ADMIN_ITEMS: NavItem[] = [
  { href: "/admin", label: "Özet", icon: "home" },
  { href: "/admin/yoklama", label: "Yoklama", icon: "check" },
  { href: "/admin/ogrenciler", label: "Kayıt", icon: "users" },
  { href: "/admin/arsiv", label: "Arşiv", icon: "archive" },
  { href: "/admin/takvim", label: "Takvim", icon: "calendar" },
  { href: "/admin/talepler", label: "Talep", icon: "bell" },
];

const INSTRUCTOR_ITEMS: NavItem[] = [
  { href: "/admin", label: "Bugün", icon: "home" },
  { href: "/admin/takvim", label: "Takvimim", icon: "calendar" },
  { href: "/admin/ogrenciler", label: "Öğrencilerim", icon: "users" },
  { href: "/admin/profil", label: "Profil", icon: "user" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <AdminShell>{children}</AdminShell>
    </AdminGuard>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin } = useStudio();
  const pathname = usePathname();
  const router = useRouter();
  const items = isSuperAdmin ? SUPER_ADMIN_ITEMS : INSTRUCTOR_ITEMS;
  const title = user ? `${staffTitle(user)} · ${user.name}` : "Admin";

  useEffect(() => {
    if (!user || isSuperAdmin) return;
    if (!canAccessAdminRoute(user, pathname)) {
      router.replace("/admin");
    }
  }, [isSuperAdmin, pathname, router, user]);

  if (!user) return null;
  if (!isSuperAdmin && !canAccessAdminRoute(user, pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Yükleniyor…
      </div>
    );
  }

  return (
    <AppShell title={title} items={items}>
      {children}
    </AppShell>
  );
}
