"use client";

import {
  BellIcon,
  CalendarIcon,
  CloseIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { useStudio } from "@/components/studio-provider";
import { STUDIO_NAME } from "@/lib/studio";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type NavIcon = "home" | "calendar" | "user" | "users" | "bell";

type NavItem = { href: string; label: string; icon: NavIcon };

const ICONS: Record<NavIcon, typeof HomeIcon> = {
  home: HomeIcon,
  calendar: CalendarIcon,
  user: UserIcon,
  users: UsersIcon,
  bell: BellIcon,
};

export function AppShell({
  title,
  items,
  children,
}: {
  title: string;
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useStudio();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    router.replace("/");
  }

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/ogrenci" && href !== "/admin" && pathname.startsWith(href))
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Menüyü aç"
              aria-expanded={menuOpen}
              aria-controls="app-menu"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-foreground shadow-sm md:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="font-serif text-xl leading-none">{STUDIO_NAME}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                {title}
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
              />
            ))}
          </nav>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white/80 px-3 py-2 text-sm text-muted shadow-sm hover:text-foreground"
          >
            <LogOutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{user?.name ?? "Çıkış"}</span>
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 md:hidden ${
          menuOpen ? "" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          tabIndex={menuOpen ? 0 : -1}
          aria-label="Menüyü kapat"
          onClick={() => setMenuOpen(false)}
          className={`absolute inset-0 bg-[#2b1a22]/30 backdrop-blur-[2px] transition-opacity duration-300 ${
            menuOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <aside
          id="app-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menü"
          className={`absolute inset-y-0 left-0 flex w-[min(18rem,86vw)] flex-col bg-white shadow-[8px_0_30px_rgba(43,26,34,0.16)] transition-transform duration-300 ease-out ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <p className="font-serif text-lg leading-none">{STUDIO_NAME}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
                {title}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Menüyü kapat"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-foreground"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
          <nav className="flex flex-1 flex-col gap-1 p-4">
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
                stacked
              />
            ))}
          </nav>
          <div className="border-t border-border p-4">
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex w-full items-center gap-2 rounded-full bg-surface-muted px-4 py-2.5 text-sm text-muted hover:text-foreground"
            >
              <LogOutIcon className="h-4 w-4" />
              Çıkış
            </button>
          </div>
        </aside>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 md:px-6">{children}</main>
    </div>
  );
}

function NavLink({
  item,
  active,
  stacked = false,
}: {
  item: NavItem;
  active: boolean;
  stacked?: boolean;
}) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm ${
        stacked ? "w-full" : ""
      } ${
        active
          ? "bg-gradient-to-r from-[#f8bbd0] to-accent-soft font-medium text-accent"
          : stacked
            ? "text-muted hover:bg-surface-muted hover:text-foreground"
            : "text-muted hover:bg-white/80 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
