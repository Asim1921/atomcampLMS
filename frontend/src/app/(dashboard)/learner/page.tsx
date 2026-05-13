"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Dna, Flame, Sparkles, Target, Trophy } from "lucide-react";
import Link from "next/link";
import { useEffect, useId } from "react";

import { OnboardingWizard } from "@/components/onboarding-wizard";
import { TutorDrawer } from "@/components/tutor-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import { useAppStore } from "@/lib/store";
import type { CourseRec, LearnerDNA, LearnerSummary } from "@/lib/types";

export default function LearnerDashboardPage() {
  const gradId = useId().replace(/:/g, "");
  const user = useAuthStore((s) => s.user);
  const selectedLearnerId = useAppStore((s) => s.selectedLearnerId);
  const setSelectedLearnerId = useAppStore((s) => s.setSelectedLearnerId);

  const learners = useQuery({
    queryKey: ["learners"],
    queryFn: () => apiGet<LearnerSummary[]>("/api/learners"),
  });

  useEffect(() => {
    if (selectedLearnerId) return;
    if (user?.learner_id) {
      setSelectedLearnerId(user.learner_id);
    } else if (learners.data?.length) {
      setSelectedLearnerId(learners.data[0].id);
    }
  }, [learners.data, selectedLearnerId, setSelectedLearnerId, user?.learner_id]);

  const learnerId = selectedLearnerId ?? user?.learner_id ?? learners.data?.[0]?.id ?? null;

  const dna = useQuery({
    queryKey: ["dna", learnerId],
    queryFn: () => apiGet<LearnerDNA>(`/api/learners/${learnerId}`),
    enabled: !!learnerId,
  });

  const recs = useQuery({
    queryKey: ["recs", learnerId],
    queryFn: () => apiGet<CourseRec[]>(`/api/recommendations/${learnerId}`),
    enabled: !!learnerId,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">Your dashboard</p>
          <h2 className="text-2xl font-bold tracking-tight text-atom-text sm:text-3xl">
            {user ? `Hey ${user.name.split(" ")[0]} 👋` : "Learner dashboard"}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-atom-muted">
            Your Learner DNA drives semantic course matches (embeddings), tutor tone, and adaptive next steps — the
            same personalization gap atomcamp learners feel at scale.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OnboardingWizard trigger={<Button variant="outline">Refresh DNA (AI diagnostic)</Button>} />
          <Button asChild variant="default">
            <Link href="https://www.atomcamp.com/" target="_blank" rel="noreferrer">
              Explore atomcamp <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI
          icon={<Trophy className="h-4 w-4" />}
          label="Quiz average"
          value={dna.data ? `${dna.data.quiz_avg}%` : "—"}
          accent
        />
        <KPI
          icon={<Flame className="h-4 w-4" />}
          label="Logins / 14d"
          value={dna.data?.engagement.logins_last_14d ?? "—"}
        />
        <KPI
          icon={<Target className="h-4 w-4" />}
          label="Confidence"
          value={dna.data ? `${(dna.data.confidence_score * 100).toFixed(0)}%` : "—"}
        />
        <KPI
          icon={<Sparkles className="h-4 w-4" />}
          label="At-risk score"
          value={dna.data ? `${(dna.data.at_risk_score * 100).toFixed(0)}%` : "—"}
          danger={!!dna.data && dna.data.at_risk_score >= 0.45}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Dna className="h-5 w-5 text-atom-accent" />
                Learner DNA
              </CardTitle>
              <CardDescription>Live profile: goal, level, struggles, confidence — consumed by every AI surface.</CardDescription>
            </div>
            {dna.data?.has_dna_embedding ? (
              <Badge variant="accent">embedding active</Badge>
            ) : (
              <Badge variant="warn">embedding pending</Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!learnerId && <Skeleton className="h-24 w-full" />}
            {dna.isLoading && <Skeleton className="h-24 w-full" />}
            {dna.data && (
              <>
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-lg border border-atom-border bg-atom-deep px-3 py-2 text-sm text-atom-text"
                    value={learnerId ?? ""}
                    onChange={(e) => setSelectedLearnerId(e.target.value)}
                  >
                    {learners.data?.map((L) => (
                      <option key={L.id} value={L.id}>
                        {L.name}
                      </option>
                    ))}
                  </select>
                  <Badge variant="default">{dna.data.current_skill_level}</Badge>
                  <Badge variant="default">pace: {dna.data.pace}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-atom-text">
                  {dna.data.goal || "Tell us your learning goal in the diagnostic to personalize this profile."}
                </p>
                {dna.data.struggle_topics.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {dna.data.struggle_topics.map((t) => (
                      <Badge key={t} variant="outline">
                        {t}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-3">
                  <Mini label="Confidence" value={`${(dna.data.confidence_score * 100).toFixed(0)}%`} accent />
                  <Mini label="Logins / 14d" value={`${dna.data.engagement.logins_last_14d}`} />
                  <Mini label="Avg session" value={`${dna.data.engagement.avg_session_min} min`} />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress pulse</CardTitle>
            <CardDescription>Quiz performance — signal for adaptive sequencing.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            {dna.data && (
              <>
                <div
                  className="relative flex h-36 w-36 items-center justify-center rounded-full border-4 border-atom-border"
                  style={{
                    background: `conic-gradient(var(--tw-gradient-stops))`,
                  }}
                >
                  <div
                    className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-atom-deep"
                    style={{
                      boxShadow: "inset 0 0 40px rgba(45,212,191,0.08)",
                    }}
                  >
                    <p className="text-3xl font-bold text-atom-accent">{dna.data.quiz_avg}%</p>
                    <p className="text-[10px] uppercase tracking-wider text-atom-muted">quiz avg</p>
                  </div>
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-atom-border"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      fill="none"
                      stroke={`url(#atomGrad-${gradId})`}
                      strokeWidth="8"
                      strokeDasharray={`${(dna.data.quiz_avg / 100) * 276.46} 276.46`}
                      strokeLinecap="round"
                    />
                    <defs>
                      <linearGradient id={`atomGrad-${gradId}`} x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#2dd4bf" />
                        <stop offset="100%" stopColor="#38bdf8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <Progress value={dna.data.quiz_avg} className="w-full" />
              </>
            )}
            {!dna.data && <Skeleton className="h-36 w-36 rounded-full" />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-atom-accent2" />
            Personalized course feed
          </CardTitle>
          <CardDescription>
            Top matches: first OpenAI embedding cosine when vectors exist; otherwise <strong>trained TF–IDF</strong> cosine
            over the course catalog; then keyword overlap.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recs.isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-36 w-full" />
              ))}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recs.data?.map((c) => (
              <div
                key={c.id}
                className="group rounded-xl border border-atom-border/70 bg-atom-deep/40 p-4 transition hover:border-atom-accent/40 hover:shadow-glow"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-atom-text group-hover:text-atom-accent">{c.title}</h3>
                  <Badge variant="accent">{(c.match_score * 100).toFixed(0)}%</Badge>
                </div>
                <p className="mt-2 line-clamp-3 text-xs text-atom-muted">{c.description}</p>
                <p className="mt-2 text-[11px] text-atom-muted/80">{c.audience}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-atom-accent/30 bg-gradient-to-br from-atom-panel to-atom-deep/60">
        <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-atom-text">Continue learning on atomcamp</p>
            <p className="text-sm text-atom-muted">Bootcamps in AI, Data Analytics, Automation, and Agentic AI.</p>
          </div>
          <Button asChild>
            <Link href="https://www.atomcamp.com/" target="_blank" rel="noreferrer">
              Open atomcamp.com
            </Link>
          </Button>
        </CardContent>
      </Card>

      <TutorDrawer learnerId={learnerId} />
    </div>
  );
}

function KPI({
  icon,
  label,
  value,
  accent,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        danger
          ? "border-atom-danger/40 bg-atom-danger/5"
          : accent
          ? "border-atom-accent/30 bg-atom-accent/5"
          : "border-atom-border/60 bg-atom-panel/60"
      }`}
    >
      <div className="flex items-center justify-between text-atom-muted">
        <span className="text-[10px] uppercase tracking-[0.18em]">{label}</span>
        <span className={accent ? "text-atom-accent" : danger ? "text-atom-danger" : ""}>{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${accent ? "text-atom-accent" : danger ? "text-atom-danger" : "text-atom-text"}`}>
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-atom-border/60 bg-atom-deep/40 p-3">
      <p className="text-xs text-atom-muted">{label}</p>
      <p className={`text-xl font-semibold ${accent ? "text-atom-accent" : "text-atom-text"}`}>{value}</p>
    </div>
  );
}
