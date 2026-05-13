"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Brain, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthGuard } from "@/components/auth-guard";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { apiPost, diagnosticStream } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type { LearnerDNA, QuizQuestion } from "@/lib/types";

type GenProgress =
  | { kind: "idle" }
  | { kind: "indeterminate"; label: string }
  | { kind: "determinate"; current: number; total: number; label: string };

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingInner />
    </AuthGuard>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [step, setStep] = useState<"goal" | "quiz" | "done">("goal");
  const [goal, setGoal] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dna, setDna] = useState<LearnerDNA | null>(null);
  const [progress, setProgress] = useState<GenProgress>({ kind: "idle" });

  // Skip onboarding entirely if the linked learner profile is already completed.
  useEffect(() => {
    if (user?.onboarding_completed) router.replace("/learner");
  }, [user, router]);

  const startMut = useMutation({
    mutationFn: async () => {
      let finalQuestions: QuizQuestion[] = [];
      setProgress({ kind: "indeterminate", label: "Contacting model…" });
      await diagnosticStream(goal, (e) => {
        if (e.stage === "started") {
          const label =
            e.provider === "ollama"
              ? "Generating with local Ollama model…"
              : e.provider === "gemini"
                ? "Generating with Gemini…"
                : "Preparing diagnostic…";
          setProgress(
            e.provider === "ollama"
              ? { kind: "determinate", current: 0, total: e.total, label }
              : { kind: "indeterminate", label },
          );
        } else if (e.stage === "progress") {
          setProgress({
            kind: "determinate",
            current: e.current,
            total: e.total,
            label: `Generating question ${Math.min(e.current + (e.current < e.total ? 1 : 0), e.total)} of ${e.total}…`,
          });
        } else if (e.stage === "thinking") {
          setProgress({ kind: "indeterminate", label: "Thinking…" });
        } else if (e.stage === "done") {
          finalQuestions = e.questions;
        } else if (e.stage === "error") {
          throw new Error(e.detail || "Quiz generation failed.");
        }
      });
      if (!finalQuestions.length) throw new Error("No questions returned.");
      return { questions: finalQuestions };
    },
    onSuccess: (data) => {
      setQuestions(data.questions || []);
      setProgress({ kind: "idle" });
      setStep("quiz");
    },
    onError: () => {
      setProgress({ kind: "idle" });
    },
  });

  const completeMut = useMutation({
    mutationFn: async () => {
      return apiPost<LearnerDNA>("/api/onboarding/diagnostic/complete", {
        learner_id: user?.learner_id ?? null,
        name: user?.name ?? "Learner",
        goal,
        answers,
      });
    },
    onSuccess: (result) => {
      setDna(result);
      setStep("done");
    },
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-aurora p-6">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 animate-floaty rounded-full bg-atom-accent/25 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 animate-floaty rounded-full bg-cyan-400/20 blur-3xl [animation-delay:1.5s]" />
      <div className="absolute inset-0 bg-grid-dense opacity-[0.35]" />

      <div className="relative mx-auto flex max-w-3xl flex-col items-center py-12">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-atom-accent/30 bg-atom-panel/60 px-3 py-1 text-xs font-medium text-atom-accent">
          <Sparkles className="h-3 w-3" />
          Build your Learner DNA
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight text-atom-text sm:text-4xl">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 max-w-xl text-center text-sm text-atom-muted">
          Tell us where you&apos;re going. We&apos;ll generate a goal-aware quiz and shape your adaptive path.
        </p>

        <div className="mt-8 w-full glass rounded-3xl border border-atom-border/70 p-8 shadow-2xl">
          <Stepper step={step} />

          {step === "goal" && (
            <div className="mt-6 space-y-5">
              <Field
                label="Your learning goal"
                placeholder="e.g. Build production-grade GenAI apps with RAG and evaluations"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                hint="Be specific — outcome > skill list. The richer this is, the better the diagnostic."
              />
              <Button
                size="lg"
                className="w-full"
                disabled={goal.trim().length < 8 || startMut.isPending}
                onClick={() => startMut.mutate()}
              >
                {startMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating quiz…
                  </>
                ) : (
                  <>
                    Generate adaptive quiz <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              {startMut.isPending && progress.kind !== "idle" && (
                <QuizGenProgress progress={progress} />
              )}
              {startMut.isError && (
                <p className="text-sm text-atom-danger">{(startMut.error as Error).message}</p>
              )}
            </div>
          )}

          {step === "quiz" && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-atom-muted">Answer all {questions.length} questions.</p>
              <div className="scrollbar-thin max-h-[55vh] space-y-4 overflow-y-auto pr-1">
                {questions.map((q) => (
                  <div key={q.id} className="rounded-2xl border border-atom-border/60 bg-atom-deep/40 p-4">
                    <p className="text-sm font-medium text-atom-text">{q.prompt}</p>
                    <div className="mt-3 space-y-2">
                      {q.choices.map((c) => (
                        <label
                          key={c.id}
                          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 transition ${
                            answers[q.id] === c.id
                              ? "border-atom-accent/50 bg-atom-accent/10"
                              : "border-transparent hover:border-atom-accent/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            className="mt-1 accent-atom-accent"
                            checked={answers[q.id] === c.id}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                          />
                          <span className="text-sm text-atom-muted">{c.text}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                size="lg"
                className="w-full"
                disabled={Object.keys(answers).length < questions.length || completeMut.isPending}
                onClick={() => completeMut.mutate()}
              >
                {completeMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Scoring with LLM…
                  </>
                ) : (
                  "Complete & save Learner DNA"
                )}
              </Button>
            </div>
          )}

          {step === "done" && dna && (
            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-atom-accent/30 bg-atom-accent/5 p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-atom-accent to-cyan-500 text-atom-deep">
                    <Brain className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-atom-text">Learner DNA created</p>
                    <p className="text-sm text-atom-muted">
                      Level <span className="text-atom-text">{dna.current_skill_level}</span> · confidence{" "}
                      <span className="text-atom-text">{(dna.confidence_score * 100).toFixed(0)}%</span> · embedding{" "}
                      {dna.has_dna_embedding ? "stored" : "pending"}.
                    </p>
                  </div>
                </div>
              </div>
              <Button size="lg" className="w-full" onClick={() => router.replace("/learner")}>
                Go to your dashboard <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <button
          onClick={() => router.replace("/learner")}
          className="mt-6 text-xs text-atom-muted hover:text-atom-text"
        >
          Skip for now — I&apos;ll do this later
        </button>
      </div>
    </div>
  );
}

function QuizGenProgress({ progress }: { progress: GenProgress }) {
  if (progress.kind === "idle") return null;
  const pct =
    progress.kind === "determinate"
      ? Math.round((progress.current / Math.max(progress.total, 1)) * 100)
      : null;
  return (
    <div className="rounded-xl border border-atom-border/60 bg-atom-deep/50 p-3">
      <div className="flex items-center justify-between text-xs text-atom-muted">
        <span>{progress.label}</span>
        {pct !== null && <span className="font-mono text-atom-text">{pct}%</span>}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-atom-border/40">
        {pct !== null ? (
          <div
            className="h-full rounded-full bg-gradient-to-r from-atom-accent to-cyan-400 transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="indeterminate-bar h-full w-full">
            <span />
          </div>
        )}
      </div>
      {progress.kind === "determinate" && (
        <p className="mt-1.5 text-[11px] text-atom-muted">
          {progress.current} of {progress.total} questions ready
        </p>
      )}
    </div>
  );
}

function Stepper({ step }: { step: "goal" | "quiz" | "done" }) {
  const idx = step === "goal" ? 0 : step === "quiz" ? 1 : 2;
  const steps = ["Goal", "Diagnostic", "Profile"];
  return (
    <div className="flex items-center gap-3">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-3">
          <div
            className={`grid h-7 w-7 flex-none place-items-center rounded-full border text-xs font-semibold ${
              i <= idx
                ? "border-atom-accent bg-atom-accent text-atom-deep"
                : "border-atom-border bg-atom-deep text-atom-muted"
            }`}
          >
            {i + 1}
          </div>
          <span className={`text-xs ${i <= idx ? "text-atom-text" : "text-atom-muted"}`}>{label}</span>
          {i < steps.length - 1 && (
            <span className={`h-px flex-1 ${i < idx ? "bg-atom-accent" : "bg-atom-border/60"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
