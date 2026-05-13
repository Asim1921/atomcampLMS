"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AuthShell } from "@/components/auth-shell";

export default function ResetPasswordRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/forgot-password");
  }, [router]);
  return (
    <AuthShell title="Redirecting…" subtitle="The reset flow has moved.">
      {null}
    </AuthShell>
  );
}
