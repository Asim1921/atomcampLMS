"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Loader2,
  PlayCircle,
  RotateCcw,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { mdToHtml } from "@/lib/markdown";
import type {
  CourseDetail,
  LessonDetail,
  QuizAttemptResult,
  QuizForLearner,
} from "@/lib/types";

export default function LessonViewerPage() {
  const params = useParams<{ id: string; lid: string }>();
  const courseId = params.id;
  const lessonId = params.lid;
  const router = useRouter();
  const qc = useQueryClient();

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => apiGet<CourseDetail>(`/api/courses/${courseId}`),
    enabled: !!courseId,
  });

  const lesson = useQuery({
    queryKey: ["lesson", courseId, lessonId],
    queryFn: () => apiGet<LessonDetail>(`/api/courses/${courseId}/lessons/${lessonId}`),
    enabled: !!courseId && !!lessonId,
  });

  const completeMut = useMutation({
    mutationFn: () => apiPost(`/api/lessons/${lessonId}/complete`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
      void qc.invalidateQueries({ queryKey: ["lesson", courseId, lessonId] });
      void qc.invalidateQueries({ queryKey: ["dna"] });
    },
  });

  const uncompleteMut = useMutation({
    mutationFn: () => apiDelete(`/api/lessons/${lessonId}/complete`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
      void qc.invalidateQueries({ queryKey: ["lesson", courseId, lessonId] });
    },
  });

  const html = useMemo(() => mdToHtml(lesson.data?.content_md ?? ""), [lesson.data?.content_md]);

  const adjacent = useMemo(() => {
    const list = course.data?.lessons ?? [];
    const idx = list.findIndex((l) => l.id === lessonId);
    return {
      prev: idx > 0 ? list[idx - 1] : null,
      next: idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null,
      index: idx,
      total: list.length,
    };
  }, [course.data?.lessons, lessonId]);

  if (course.isLoading || lesson.isLoading) {
    return <Skeleton className="h-[80vh] w-full" />;
  }
  if (!course.data || !lesson.data) {
    return <p className="text-sm text-atom-danger">Lesson not found.</p>;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* sidebar */}
      <aside className="space-y-3">
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link href={`/courses/${courseId}`}>
            <ChevronLeft className="h-4 w-4" /> Back to course
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{course.data.title}</CardTitle>
            <CardDescription>
              Lesson {adjacent.index + 1} of {adjacent.total}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-atom-border/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-atom-accent to-cyan-500"
                style={{ width: `${course.data.progress_pct}%` }}
              />
            </div>
            <p className="mt-2 px-1 text-[10px] text-atom-muted">{course.data.progress_pct}% complete</p>
            <ol className="mt-3 max-h-[55vh] space-y-1 overflow-y-auto scrollbar-thin">
              {course.data.lessons.map((l, i) => (
                <li key={l.id}>
                  <Link
                    href={`/courses/${courseId}/lessons/${l.id}`}
                    className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs transition ${
                      l.id === lessonId
                        ? "bg-atom-accent/10 text-atom-accent"
                        : "text-atom-muted hover:bg-atom-deep/40 hover:text-atom-text"
                    }`}
                  >
                    {l.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 flex-none text-atom-accent" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 flex-none" />
                    )}
                    <span className="line-clamp-1 flex-1">
                      <span className="font-mono text-[10px] text-atom-muted/80">{i + 1}.</span> {l.title}
                    </span>
                    {l.has_quiz && <Badge variant="outline" className="text-[9px]">Q</Badge>}
                  </Link>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </aside>

      {/* main */}
      <article className="space-y-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-atom-muted">
            Lesson {adjacent.index + 1} · {lesson.data.estimated_minutes} min
          </p>
          <h1 className="mt-1 text-3xl font-bold text-atom-text">{lesson.data.title}</h1>
          {lesson.data.summary && (
            <p className="mt-2 text-sm text-atom-muted">{lesson.data.summary}</p>
          )}
        </div>

        {lesson.data.video_url && (
          <div className="overflow-hidden rounded-2xl border border-atom-border/60 bg-atom-deep">
            <iframe
              src={lesson.data.video_url}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        <Card>
          <CardContent className="prose prose-invert max-w-none px-8 py-8">
            <div
              className="space-y-2 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: html || '<p class="text-atom-muted">(No content)</p>' }}
            />
          </CardContent>
        </Card>

        {lesson.data.has_quiz ? (
          <LessonQuiz lessonId={lessonId} courseId={courseId} />
        ) : (
          <div className="flex items-center justify-between rounded-2xl border border-atom-border/60 bg-atom-panel/60 p-4">
            <p className="text-sm text-atom-muted">No quiz on this lesson. Mark it complete when you&apos;re done.</p>
            {lesson.data.completed ? (
              <Button
                variant="outline"
                onClick={() => uncompleteMut.mutate()}
                disabled={uncompleteMut.isPending}
              >
                <RotateCcw className="h-4 w-4" /> Mark incomplete
              </Button>
            ) : (
              <Button onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
                {completeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Mark complete
              </Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            disabled={!adjacent.prev}
            onClick={() => adjacent.prev && router.push(`/courses/${courseId}/lessons/${adjacent.prev.id}`)}
          >
            <ArrowLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            disabled={!adjacent.next}
            onClick={() => adjacent.next && router.push(`/courses/${courseId}/lessons/${adjacent.next.id}`)}
          >
            Next lesson <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </article>
    </div>
  );
}

function LessonQuiz({ lessonId, courseId }: { lessonId: string; courseId: string }) {
  const qc = useQueryClient();
  const quiz = useQuery({
    queryKey: ["quiz", lessonId],
    queryFn: () => apiGet<QuizForLearner>(`/api/lessons/${lessonId}/quiz`),
  });

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const attempt = useMutation({
    mutationFn: () =>
      apiPost<QuizAttemptResult>(`/api/lessons/${lessonId}/quiz/attempt`, { answers }),
    onSuccess: (data) => {
      setResult(data);
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
      void qc.invalidateQueries({ queryKey: ["lesson", courseId, lessonId] });
      void qc.invalidateQueries({ queryKey: ["dna"] });
    },
  });

  function reset() {
    setAnswers({});
    setResult(null);
  }

  if (quiz.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!quiz.data) return null;

  const allAnswered = quiz.data.questions.every((q) => answers[q.id]);

  return (
    <Card className="border-atom-accent/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-atom-accent" />
          {quiz.data.title}
        </CardTitle>
        <CardDescription>
          Passing score: {quiz.data.passing_score}% · {quiz.data.questions.length} question
          {quiz.data.questions.length === 1 ? "" : "s"}
          {quiz.data.best_score != null && (
            <> · Best score so far: <span className="text-atom-text">{quiz.data.best_score}%</span></>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {quiz.data.questions.map((q, i) => {
          const correctId = result?.per_question?.[q.id]?.correct_choice_id;
          return (
            <div key={q.id} className="rounded-2xl border border-atom-border/60 bg-atom-deep/40 p-4">
              <p className="text-sm font-medium text-atom-text">
                <span className="text-atom-accent">Q{i + 1}.</span> {q.prompt}
              </p>
              <div className="mt-3 space-y-2">
                {q.choices.map((c) => {
                  const chosen = answers[q.id] === c.id;
                  const showRight = result && c.id === correctId;
                  const showWrong = result && chosen && c.id !== correctId;
                  return (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2 py-1.5 transition ${
                        showRight
                          ? "border-atom-accent/60 bg-atom-accent/10"
                          : showWrong
                          ? "border-atom-danger/60 bg-atom-danger/10"
                          : chosen
                          ? "border-atom-accent/40 bg-atom-accent/5"
                          : "border-transparent hover:border-atom-accent/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        className="mt-1 accent-atom-accent"
                        checked={chosen}
                        disabled={!!result}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: c.id }))}
                      />
                      <span className="text-sm text-atom-muted">{c.text}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}

        {result ? (
          <div
            className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
              result.passed
                ? "border-atom-accent/40 bg-atom-accent/5"
                : "border-atom-warn/40 bg-atom-warn/5"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`grid h-12 w-12 place-items-center rounded-xl ${
                  result.passed ? "bg-atom-accent/20 text-atom-accent" : "bg-atom-warn/20 text-atom-warn"
                }`}
              >
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-atom-text">
                  {result.passed ? "Nice — you passed!" : "Not quite — try again."}
                </p>
                <p className="text-xs text-atom-muted">
                  Score: {result.score}% ({result.correct} / {result.total}) ·{" "}
                  {result.new_quiz_avg != null && (
                    <>Your Learner DNA quiz_avg is now <span className="text-atom-text">{result.new_quiz_avg}%</span></>
                  )}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
          </div>
        ) : (
          <Button
            className="w-full"
            disabled={!allAnswered || attempt.isPending}
            onClick={() => attempt.mutate()}
          >
            {attempt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit answers"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
