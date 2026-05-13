"use client";

import { CheckCircle2, Loader2, Lock, Mail, RotateCw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { useAuthStore } from "@/lib/auth";

type Step = "email" | "verify" | "done";

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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const forgotPassword = useAuthStore((s) => s.forgotPassword);
  const resetPassword = useAuthStore((s) => s.resetPassword);

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // TTL countdown for resend button
  const [secondsLeft, setSecondsLeft] = useState(0);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  const score = useMemo(() => strengthScore(password), [password]);

  async function sendCode() {
    setError(null);
    setInfo(null);
    setPending(true);
    try {
      await forgotPassword(email.trim());
      setSecondsLeft(60);
      setStep("verify");
      setInfo("If the email is registered, a 6-digit verification code is on its way.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  async function onResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== 6) {
      setError("Please enter the full 6-digit verification code.");
      return;
    }
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
      await resetPassword(email.trim(), code, password);
      setStep("done");
      setTimeout(() => router.replace("/login"), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title={
        step === "email"
          ? "Forgot your password?"
          : step === "verify"
          ? "Check your inbox"
          : "Password updated"
      }
      subtitle={
        step === "email"
          ? "Enter the email on your account. We'll send a 6-digit verification code."
          : step === "verify"
          ? "Enter the 6-digit code we sent to your email, then choose a new password. Code expires in 15 minutes."
          : "You're all set — redirecting to sign in."
      }
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-atom-accent hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {step === "email" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
          className="space-y-4"
        >
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
          {error && (
            <div className="rounded-lg border border-atom-danger/40 bg-atom-danger/10 px-3 py-2 text-sm text-atom-danger">
              {error}
            </div>
          )}
          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending code…
              </>
            ) : (
              "Send verification code"
            )}
          </Button>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={onResetSubmit} className="space-y-5">
          {info && (
            <div className="flex items-start gap-2 rounded-xl border border-atom-accent/30 bg-atom-accent/5 px-3 py-2 text-xs text-atom-muted">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-atom-accent" />
              <span>{info}</span>
            </div>
          )}

          <div>
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-atom-muted">
              Verification code
            </span>
            <OtpInput value={code} onChange={setCode} disabled={pending} autoFocus />
            <div className="mt-2 flex items-center justify-between text-[11px] text-atom-muted">
              <span>Sent to {email}</span>
              <button
                type="button"
                onClick={sendCode}
                disabled={secondsLeft > 0 || pending}
                className="inline-flex items-center gap-1 text-atom-accent hover:underline disabled:opacity-50 disabled:no-underline"
              >
                <RotateCw className="h-3 w-3" /> {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
              </button>
            </div>
          </div>

          <Field
            label="New password"
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
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            required
            placeholder="Repeat your new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            icon={<Lock className="h-4 w-4" />}
          />

          {error && (
            <div className="rounded-lg border border-atom-danger/40 bg-atom-danger/10 px-3 py-2 text-sm text-atom-danger">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Updating…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" /> Reset password
              </>
            )}
          </Button>

          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className="block w-full text-center text-xs text-atom-muted hover:text-atom-text"
          >
            Use a different email
          </button>
        </form>
      )}

      {step === "done" && (
        <div className="flex items-start gap-3 rounded-2xl border border-atom-accent/30 bg-atom-accent/5 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-atom-accent" />
          <div>
            <p className="text-sm font-semibold text-atom-text">Password updated</p>
            <p className="text-sm text-atom-muted">Redirecting you to sign in…</p>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
