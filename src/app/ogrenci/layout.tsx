"use client";

import { AppShell } from "@/components/app-shell";
import { RoleGuard } from "@/components/role-guard";

const ITEMS = [
  { href: "/ogrenci", label: "Özet", icon: "home" as const },
  { href: "/ogrenci/program", label: "Takvim", icon: "calendar" as const },
  { href: "/ogrenci/profil", label: "Profil", icon: "user" as const },
];

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard role="student">
      <AppShell title="Öğrenci" items={ITEMS}>
        {children}
      </AppShell>
    </RoleGuard>
  );
}
