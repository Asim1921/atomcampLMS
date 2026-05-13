"use client";

import {
  BookOpen,
  Brain,
  ChevronDown,
  GraduationCap,
  LayoutDashboard,
  Library,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth";

import { Badge } from "./ui/badge";

type NavItem = {
  href: string;
  label: string;
  icon: typeof GraduationCap;
  prefix?: string;
  roles?: ("learner" | "instructor" | "admin")[];
};

const navItems: NavItem[] = [
  { href: "/learner", label: "Dashboard", icon: GraduationCap },
  { href: "/courses", label: "Catalog", icon: Library, prefix: "/courses" },
  { href: "/me/learning", label: "My Learning", icon: BookOpen },
  { href: "/instructor/courses", label: "Author", icon: Wrench, prefix: "/instructor/courses", roles: ["instructor", "admin"] },
  { href: "/instructor", label: "Instructor", icon: LayoutDashboard, prefix: "/instructor", roles: ["instructor", "admin"] },
  { href: "/admin", label: "Admin", icon: LineChart, prefix: "/admin", roles: ["admin"] },
];

function visibleFor(role: string | undefined, item: NavItem): boolean {
  if (!item.roles) return true;
  return !!role && item.roles.includes(role as "admin");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-aurora">
      {navOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <aside
        className={cn(
          // Mobile: slide-in drawer up to 18rem (capped at 88vw on very small phones).
          // Desktop (lg+): exactly 16rem so it matches `lg:pl-64` on the content area.
          "fixed inset-y-0 left-0 z-40 flex w-[min(18rem,88vw)] flex-col border-r border-atom-border/60 bg-atom-navy/90 backdrop-blur-xl transition-transform duration-200 ease-out lg:w-64 lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <Link href="/" className="flex items-center gap-2 border-b border-atom-border/60 px-5 py-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-atom-accent to-cyan-500 text-atom-deep shadow-glow">
            <Brain className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">AtomAdapt</p>
            <p className="truncate text-sm text-atom-muted">for atomcamp</p>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 scrollbar-thin">
          {navItems.filter((i) => visibleFor(user?.role, i)).map((item) => {
            const Icon = item.icon;
            const active = item.prefix ? pathname?.startsWith(item.prefix) : pathname === item.href;
            return (
              <Link key={item.href} href={item.href} onClick={() => setNavOpen(false)}>
                <span
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                    active
                      ? "border border-atom-border/80 bg-atom-panel text-atom-text shadow-inner"
                      : "text-atom-muted hover:bg-atom-panel/50 hover:text-atom-text",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-atom-border/60 p-4">
          <p className="mb-1 text-xs uppercase tracking-wide text-atom-muted">Role</p>
          <p className="text-sm capitalize text-atom-text">{user?.role ?? "learner"}</p>
          <p className="mt-3 flex items-center gap-1 text-xs text-atom-muted">
            <Sparkles className="h-3 w-3 shrink-0 text-atom-accent" />
            <span>Learner DNA powers all AI surfaces</span>
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex flex-col gap-3 border-b border-atom-border/60 bg-atom-deep/85 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <button
              type="button"
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-atom-border/60 bg-atom-panel/70 text-atom-text lg:hidden"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-atom-text sm:text-lg">Smart Adaptive LMS</h1>
              <p className="text-xs text-atom-muted sm:text-sm">
                Personalized paths · instructor signals · cohort intelligence.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3">
            <Badge variant="accent" className="hidden md:inline-flex">
              atomcamp-aligned
            </Badge>
            <UserMenu
              name={user?.name ?? "Guest"}
              email={user?.email ?? ""}
              avatar={user?.avatar_url ?? null}
              onLogout={() => {
                logout();
                router.replace("/login");
              }}
            />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function UserMenu({
  name,
  email,
  avatar,
  onLogout,
}: {
  name: string;
  email: string;
  avatar: string | null;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex max-w-full items-center gap-2 rounded-xl border border-atom-border/60 bg-atom-panel/70 px-2 py-1.5 text-sm text-atom-text transition hover:border-atom-accent/40"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="h-7 w-7 shrink-0 rounded-lg object-cover" />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-atom-accent to-cyan-500 text-xs font-bold text-atom-deep">
            {initials || <UserIcon className="h-3.5 w-3.5" />}
          </span>
        )}
        <span className="hidden min-w-0 text-left md:block">
          <span className="block max-w-[140px] truncate text-xs font-semibold">{name}</span>
          <span className="block max-w-[140px] truncate text-[11px] text-atom-muted">{email}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-atom-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-xl border border-atom-border/80 bg-atom-panel/95 shadow-2xl backdrop-blur">
          <div className="border-b border-atom-border/60 px-3 py-3">
            <p className="text-sm font-semibold text-atom-text">{name}</p>
            <p className="truncate text-xs text-atom-muted">{email}</p>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-atom-muted hover:bg-atom-deep/60 hover:text-atom-text"
          >
            <Settings className="h-4 w-4" /> Profile settings
          </Link>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 border-t border-atom-border/40 px-3 py-2 text-left text-sm text-atom-danger hover:bg-atom-danger/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
