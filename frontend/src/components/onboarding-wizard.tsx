"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { apiPost, diagnosticStream } from "@/lib/api";
import type { LearnerDNA, QuizQuestion } from "@/lib/types";
import { useAppStore } from "@/lib/store";

type GenProgress =
  | { kind: "idle" }
  | { kind: "indeterminate"; label: string }
  | { kind: "determinate"; current: number; total: number; label: string };

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";

type Props = {
  trigger?: React.ReactNode;
};

export function OnboardingWizard({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"goal" | "quiz" | "done">("goal");
  const [goal, setGoal] = useState("");
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<LearnerDNA | null>(null);
  const [progress, setProgress] = useState<GenProgress>({ kind: "idle" });
  const setSelectedLearnerId = useAppStore((s) => s.setSelectedLearnerId);

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
        learner_id: null,
        name: name || "Learner",
        goal,
        answers,
      });
    },
    onSuccess: (dna) => {
      setResult(dna);
      setSelectedLearnerId(dna.id);
      setStep("done");
    },
  });

  const reset = () => {
    setStep("goal");
    setGoal("");
    setName("");
    setQuestions([]);
    setAnswers({});
    setResult(null);
    setProgress({ kind: "idle" });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm">Update Learner DNA</Button>}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-atom-border bg-atom-panel p-0">
        <DialogHeader>
          <DialogTitle>AI onboarding diagnostic</DialogTitle>
          <p className="px-6 pb-2 text-sm text-atom-muted">
            Goal-aware questions (LLM-generated when API key is set). Results write into your Learner DNA profile.
          </p>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6">
          {step === "goal" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-atom-muted">Your name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayesha Khan" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-atom-muted">Learning goal</label>
                <Input
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g. Build GenAI apps with RAG for my startup"
                />
              </div>
              <Button
                disabled={goal.trim().length < 8 || startMut.isPending}
                onClick={() => startMut.mutate()}
                className="w-full"
              >
                {startMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating quiz…
                  </>
                ) : (
                  "Generate adaptive quiz"
                )}
              </Button>
              {startMut.isPending && progress.kind !== "idle" && (
                <QuizGenProgress progress={progress} />
              )}
              {startMut.isError && (
                <p className="text-sm text-atom-danger">{(startMut.error as Error).message}</p>
              )}
            </>
          )}
          {step === "quiz" && (
            <>
              <p className="text-sm text-atom-muted">Answer all {questions.length} questions.</p>
              <div className="max-h-[48vh] space-y-4 overflow-y-auto pr-1">
                {questions.map((q) => (
                  <div key={q.id} className="rounded-xl border border-atom-border/60 bg-atom-deep/40 p-4">
                    <p className="text-sm font-medium text-atom-text">{q.prompt}</p>
                    <div className="mt-3 space-y-2">
                      {q.choices.map((c) => (
                        <label
                          key={c.id}
                          className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-atom-accent/30"
                        >
                          <input
                            type="radio"
                            name={q.id}
                            className="mt-1"
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
            </>
          )}
          {step === "done" && result && (
            <div className="space-y-3 rounded-xl border border-atom-accent/30 bg-atom-deep/50 p-4">
              <p className="text-sm font-semibold text-atom-accent">Learner DNA updated</p>
              <p className="text-sm text-atom-text">
                <span className="text-atom-muted">Level:</span> {result.current_skill_level} ·{" "}
                <span className="text-atom-muted">Confidence:</span> {(result.confidence_score * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-atom-muted">
                Embedding {result.has_dna_embedding ? "stored" : "pending"} — recommendations use semantic match when
                embeddings are available.
              </p>
              <Button className="w-full" onClick={() => setOpen(false)}>
                Go to dashboard
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
