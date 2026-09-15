"use client";

import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  CloseIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  UserIcon,
  UsersIcon,
  ArchiveIcon,
} from "@/components/icons";
import { useStudio } from "@/components/studio-provider";
import { STUDIO_NAME } from "@/lib/studio";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type NavIcon =
  | "home"
  | "calendar"
  | "user"
  | "users"
  | "bell"
  | "check"
  | "archive";

type NavItem = { href: string; label: string; icon: NavIcon };

const ICONS: Record<NavIcon, typeof HomeIcon> = {
  home: HomeIcon,
  calendar: CalendarIcon,
  user: UserIcon,
  users: UsersIcon,
  bell: BellIcon,
  check: CheckIcon,
  archive: ArchiveIcon,
};

export function AppShell({
  items,
  children,
}: {
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useStudio();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
    setAccountMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !accountMenuOpen) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      setAccountMenuOpen(false);
    }

    document.addEventListener("keydown", onKey);
    if (menuOpen) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      if (menuOpen) document.body.style.overflow = "";
    };
  }, [menuOpen, accountMenuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    setAccountMenuOpen(false);
    logout();
    router.replace("/giris");
  }

  const profileHref = user?.role === "student" ? "/ogrenci/profil" : "/admin/profil";

  function isActive(href: string) {
    return (
      pathname === href ||
      (href !== "/ogrenci" && href !== "/admin" && pathname.startsWith(href))
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 px-4 pt-4 md:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-white/80 bg-white/78 px-2 py-2 shadow-[0_10px_36px_rgba(194,24,91,0.14)] backdrop-blur-xl md:gap-3 md:px-3 md:py-2.5">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="Menüyü aç"
              aria-expanded={menuOpen}
              aria-controls="app-menu"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted/80 text-foreground md:hidden"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0 pl-1">
              <p className="truncate font-serif text-lg leading-none md:text-xl">
                {STUDIO_NAME}
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 p-1 md:flex">
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(item.href)}
              />
            ))}
          </nav>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setAccountMenuOpen((open) => !open);
              }}
              aria-label="Hesap menüsünü aç"
              aria-haspopup="menu"
              aria-expanded={accountMenuOpen}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[#ec407a] to-accent px-3 py-2 text-sm font-medium text-white shadow-[0_6px_18px_rgba(194,24,91,0.28)] hover:from-accent hover:to-accent-hover"
            >
              <UserIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.name ?? "Hesap"}</span>
            </button>
            {accountMenuOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Hesap menüsünü kapat"
                  onClick={() => setAccountMenuOpen(false)}
                  className="fixed inset-0 z-30 cursor-default"
                />
                <div
                  role="menu"
                  aria-label="Hesap menüsü"
                  className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-white p-2 shadow-[0_12px_32px_rgba(43,26,34,0.16)]"
                >
                  <div className="px-3 py-2">
                    <p className="font-medium text-foreground">{user?.name ?? "Hesap"}</p>
                    {user?.email ? <p className="mt-0.5 truncate text-xs text-muted">{user.email}</p> : null}
                  </div>
                  <div className="my-1 h-px bg-border" />
                  <Link
                    href={profileHref}
                    role="menuitem"
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
                  >
                    <UserIcon className="h-4 w-4" />
                    Profil
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-rose-700 hover:bg-rose-50"
                  >
                    <LogOutIcon className="h-4 w-4" />
                    Çıkış yap
                  </button>
                </div>
              </>
            ) : null}
          </div>
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 md:px-6 md:py-8">{children}</main>
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
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-all duration-200 md:px-4 ${
        stacked ? "w-full" : ""
      } ${
        active
          ? "bg-white font-medium text-accent shadow-[0_4px_14px_rgba(43,26,34,0.06)]"
          : stacked
            ? "text-muted hover:bg-white/60 hover:text-foreground"
            : "text-muted hover:bg-white/50 hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}
