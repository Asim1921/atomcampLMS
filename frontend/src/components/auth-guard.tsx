"use client";

import { Loader2 } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "@/lib/auth";
import { useAppStore } from "@/lib/store";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const setSelectedLearnerId = useAppStore((s) => s.setSelectedLearnerId);

  useEffect(() => {
    if (status === "unauthenticated") setSelectedLearnerId(null);
  }, [status, setSelectedLearnerId]);

  useEffect(() => {
    if (status === "unauthenticated") {
      const next = encodeURIComponent(pathname || "/learner");
      router.replace(`/login?next=${next}`);
    }
  }, [status, router, pathname]);

  if (status === "authenticated") return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-aurora">
      <div className="flex items-center gap-3 rounded-2xl border border-atom-border/60 bg-atom-panel/70 px-5 py-4 backdrop-blur">
        <Loader2 className="h-4 w-4 animate-spin text-atom-accent" />
        <span className="text-sm text-atom-muted">Securing your session…</span>
      </div>
    </div>
  );
}
