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
  { href: "/instructor/courses", label: "Author", icon: Wrench, prefix: "/instructor/courses" },
  { href: "/instructor", label: "Instructor", icon: LayoutDashboard, prefix: "/instructor" },
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

  return (
    <div className="flex min-h-screen bg-aurora">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-atom-border/60 bg-atom-navy/85 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 border-b border-atom-border/60 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-atom-accent to-cyan-500 text-atom-deep shadow-glow">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">AtomAdapt</p>
            <p className="text-sm text-atom-muted">for atomcamp</p>
          </div>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3 scrollbar-thin">
          {navItems.filter((i) => visibleFor(user?.role, i)).map((item) => {
            const Icon = item.icon;
            const active = item.prefix
              ? pathname?.startsWith(item.prefix)
              : pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
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
            <Sparkles className="h-3 w-3 text-atom-accent" />
            Learner DNA powers all AI surfaces
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-atom-border/60 bg-atom-deep/80 px-8 py-4 backdrop-blur-md">
          <div>
            <h1 className="text-lg font-semibold text-atom-text">Smart Adaptive LMS</h1>
            <p className="text-sm text-atom-muted">
              Personalized paths · instructor signals · cohort intelligence.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="accent" className="hidden sm:inline-flex">
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
        <main className="flex-1 px-8 py-8">{children}</main>
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
        className="flex items-center gap-2 rounded-xl border border-atom-border/60 bg-atom-panel/70 px-2 py-1.5 text-sm text-atom-text transition hover:border-atom-accent/40"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="h-7 w-7 rounded-lg object-cover" />
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-atom-accent to-cyan-500 text-xs font-bold text-atom-deep">
            {initials || <UserIcon className="h-3.5 w-3.5" />}
          </span>
        )}
        <span className="hidden text-left md:block">
          <span className="block max-w-[140px] truncate text-xs font-semibold">{name}</span>
          <span className="block max-w-[140px] truncate text-[11px] text-atom-muted">{email}</span>
        </span>
        <ChevronDown className="h-4 w-4 text-atom-muted" />
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-56 overflow-hidden rounded-xl border border-atom-border/80 bg-atom-panel/95 shadow-2xl backdrop-blur">
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
