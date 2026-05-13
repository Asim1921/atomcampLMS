"use client";

import {
  ArrowRight,
  BarChart3,
  Brain,
  GraduationCap,
  LineChart,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "authenticated") router.replace("/learner");
  }, [status, router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-aurora">
      <div className="absolute inset-0 bg-grid-dense opacity-[0.3]" />
      <div className="pointer-events-none absolute -left-32 top-20 h-96 w-96 animate-floaty rounded-full bg-atom-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-60 h-96 w-96 animate-floaty rounded-full bg-cyan-400/20 blur-3xl [animation-delay:1.5s]" />

      {/* nav */}
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-atom-accent to-cyan-500 text-atom-deep shadow-glow">
            <Brain className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">AtomAdapt</p>
            <p className="text-xs text-atom-muted">Smart Adaptive LMS</p>
          </div>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-atom-muted transition hover:text-atom-text">
            Sign in
          </Link>
          <Button asChild size="sm">
            <Link href="/signup">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </nav>
      </header>

      {/* hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-12 text-center sm:pt-20">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-atom-accent/30 bg-atom-panel/60 px-3 py-1 text-xs font-medium text-atom-accent">
          <Sparkles className="h-3 w-3" />
          Inter-University National AI Hackathon
        </div>
        <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight text-atom-text sm:text-6xl lg:text-7xl">
          The adaptive LMS layer for{" "}
          <span className="text-shimmer">atomcamp</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-base text-atom-muted sm:text-lg">
          A Learner DNA that updates in real time — powering personalized recommendations, AI tutoring, and
          instructor signals so no two learners are treated alike.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/signup">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">I already have an account</Link>
          </Button>
        </div>
        <p className="mx-auto mt-6 max-w-md text-xs text-atom-muted/80">
          No credit card. Built end-to-end in 6 hours for the hackathon.
        </p>

        {/* feature grid */}
        <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature
            icon={<Target className="h-5 w-5" />}
            title="Goal-aware onboarding"
            body="An LLM-built diagnostic captures your goal, level, and struggle topics into a living Learner DNA."
          />
          <Feature
            icon={<Workflow className="h-5 w-5" />}
            title="Semantic course feed"
            body="Embeddings + cosine surface the right courses — graceful fallback to a trained TF-IDF model."
          />
          <Feature
            icon={<Brain className="h-5 w-5" />}
            title="Streaming AI tutor"
            body="Your tutor reads your DNA before every reply — Socratic, calibrated to your level."
          />
          <Feature
            icon={<BarChart3 className="h-5 w-5" />}
            title="At-risk prediction"
            body="A scikit-learn gradient boosted model flags struggling learners from engagement features."
          />
          <Feature
            icon={<GraduationCap className="h-5 w-5" />}
            title="Instructor drafts"
            body="One click drafts an intervention message tailored to a learner's risk profile and DNA."
          />
          <Feature
            icon={<LineChart className="h-5 w-5" />}
            title="Cohort intelligence"
            body="Weekly LLM-narrated summaries help admins act before issues hit retention."
          />
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-7xl px-6 pb-10 pt-4 text-center text-xs text-atom-muted/80">
        © {new Date().getFullYear()} AtomAdapt · Built for the National AI Hackathon
      </footer>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="group rounded-2xl border border-atom-border/60 bg-atom-panel/50 p-5 text-left backdrop-blur transition hover:border-atom-accent/40 hover:shadow-glow">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-atom-accent/30 bg-atom-accent/10 text-atom-accent">
        {icon}
      </div>
      <p className="mt-4 text-base font-semibold text-atom-text group-hover:text-atom-accent">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-atom-muted">{body}</p>
    </div>
  );
}
