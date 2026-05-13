"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { API, apiPost, getToken } from "@/lib/api";
import type { LearnerDNA, QuizQuestion } from "@/lib/types";
import { useAppStore } from "@/lib/store";

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
  const setSelectedLearnerId = useAppStore((s) => s.setSelectedLearnerId);

  const startMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API}/api/onboarding/diagnostic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ goal }),
      });
      if (!res.ok) throw new Error("Failed to start diagnostic");
      return res.json() as Promise<{ questions: QuizQuestion[] }>;
    },
    onSuccess: (data) => {
      setQuestions(data.questions || []);
      setStep("quiz");
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
