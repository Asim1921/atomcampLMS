"use client";

import { Loader2, Lock, Mail, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { useAuthStore } from "@/lib/auth";

function strengthScore(pw: string): number {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Too short", "Weak", "Okay", "Strong", "Excellent"];

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((s) => s.signup);
  const status = useAuthStore((s) => s.status);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/onboarding");
  }, [status, router]);

  const score = useMemo(() => strengthScore(password), [password]);
  const passwordsMatch = password === confirm || !confirm;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setPending(true);
    try {
      await signup(name.trim(), email.trim(), password);
      router.replace("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Build your Learner DNA and unlock personalized paths in minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-atom-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field
          label="Full name"
          autoComplete="name"
          required
          placeholder="Ayesha Khan"
          value={name}
          onChange={(e) => setName(e.target.value)}
          icon={<User className="h-4 w-4" />}
        />
        <Field
          label="Email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="h-4 w-4" />}
        />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
        />
        {password && (
          <div className="-mt-2 space-y-1">
            <div className="flex h-1.5 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-full flex-1 rounded-full transition-colors ${
                    i < score
                      ? score === 1
                        ? "bg-atom-danger"
                        : score === 2
                        ? "bg-atom-warn"
                        : "bg-atom-accent"
                      : "bg-atom-border/60"
                  }`}
                />
              ))}
            </div>
            <p className="text-[11px] text-atom-muted">{STRENGTH_LABELS[score]}</p>
          </div>
        )}
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Repeat your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          icon={<Lock className="h-4 w-4" />}
          error={!passwordsMatch ? "Passwords don't match" : null}
        />

        {error && (
          <div className="rounded-lg border border-atom-danger/40 bg-atom-danger/10 px-3 py-2 text-sm text-atom-danger">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Creating your account…
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <p className="text-center text-[11px] leading-relaxed text-atom-muted">
          By signing up you agree to AtomAdapt&apos;s educational use terms during this hackathon demo.
        </p>
      </form>
    </AuthShell>
  );
}
