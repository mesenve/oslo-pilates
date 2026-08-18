"use client";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";

const ITEMS = [
  { href: "/admin", label: "Özet", icon: "home" as const },
  { href: "/admin/ogrenciler", label: "Kayıt", icon: "users" as const },
  { href: "/admin/takvim", label: "Takvim", icon: "calendar" as const },
  { href: "/admin/talepler", label: "Talep", icon: "bell" as const },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard role="admin">
      <AppShell title="Admin" items={ITEMS}>
        {children}
      </AppShell>
    </RoleGuard>
  );
}
