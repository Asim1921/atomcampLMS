"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Pencil,
  PlayCircle,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type { CourseDetail } from "@/lib/types";

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const course = useQuery({
    queryKey: ["course", id],
    queryFn: () => apiGet<CourseDetail>(`/api/courses/${id}`),
    enabled: !!id,
  });

  const enrollMut = useMutation({
    mutationFn: () => apiPost(`/api/courses/${id}/enroll`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course", id] });
      void qc.invalidateQueries({ queryKey: ["courses"] });
      void qc.invalidateQueries({ queryKey: ["my-learning"] });
    },
  });

  const unenrollMut = useMutation({
    mutationFn: () => apiDelete(`/api/courses/${id}/enroll`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course", id] });
      void qc.invalidateQueries({ queryKey: ["courses"] });
      void qc.invalidateQueries({ queryKey: ["my-learning"] });
    },
  });

  if (course.isLoading || !course.data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  const c = course.data;
  const isOwner = user && c.owner_user_id === user.id;
  const isAdmin = user?.role === "admin";
  const firstLesson = c.lessons[0];

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="overflow-hidden rounded-3xl border border-atom-border/60 bg-gradient-to-br from-atom-panel via-atom-deep/40 to-atom-deep">
        <div className="grid gap-6 p-8 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-4xl">{c.cover_emoji}</span>
              <Badge variant="outline">{c.level}</Badge>
              {c.owner_name && <span className="text-xs text-atom-muted">by {c.owner_name}</span>}
              {!c.published && <Badge variant="warn">draft</Badge>}
            </div>
            <h1 className="text-3xl font-bold text-atom-text">{c.title}</h1>
            <p className="text-sm text-atom-muted">{c.description}</p>
            {c.audience && (
              <p className="text-xs text-atom-muted/80">
                <span className="font-semibold text-atom-muted">Audience: </span>
                {c.audience}
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <Badge key={t} variant="outline" className="capitalize">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-2xl border border-atom-border/60 bg-atom-panel/60 p-5">
            <Stat icon={<BookOpen className="h-3.5 w-3.5" />} label="Lessons" value={c.lesson_count} />
            <Stat icon={<Clock className="h-3.5 w-3.5" />} label="Duration" value={`${c.duration_hours}h`} />
            <Stat icon={<Users className="h-3.5 w-3.5" />} label="Enrolled" value={c.enrolled_count} />

            {c.is_enrolled && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-atom-muted">
                  <span>Progress</span>
                  <span>{c.progress_pct}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-atom-border/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-atom-accent to-cyan-500"
                    style={{ width: `${c.progress_pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-1 flex flex-col gap-2">
              {!c.is_enrolled ? (
                <Button onClick={() => enrollMut.mutate()} disabled={enrollMut.isPending}>
                  {enrollMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enroll now"}
                </Button>
              ) : firstLesson ? (
                <Button asChild>
                  <Link href={`/courses/${c.id}/lessons/${firstLesson.id}`}>
                    {c.progress_pct === 0 ? "Start learning" : "Continue learning"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button disabled>No lessons yet</Button>
              )}
              {c.is_enrolled && (
                <Button
                  variant="outline"
                  onClick={() => unenrollMut.mutate()}
                  disabled={unenrollMut.isPending}
                >
                  {unenrollMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unenroll"}
                </Button>
              )}
              {(isOwner || isAdmin) && (
                <Button asChild variant="outline">
                  <Link href={`/instructor/courses/${c.id}`}>
                    <Pencil className="h-4 w-4" /> Manage course
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Syllabus</CardTitle>
          <CardDescription>
            {c.lessons.length} lesson{c.lessons.length === 1 ? "" : "s"}
            {c.prerequisites.length > 0 && (
              <> · Prereqs: {c.prerequisites.join(", ")}</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {c.lessons.length === 0 ? (
            <p className="text-sm text-atom-muted">
              No lessons yet.{" "}
              {(isOwner || isAdmin) && (
                <Link href={`/instructor/courses/${c.id}`} className="text-atom-accent hover:underline">
                  Add the first one →
                </Link>
              )}
            </p>
          ) : (
            <ol className="divide-y divide-atom-border/40 overflow-hidden rounded-xl border border-atom-border/40">
              {c.lessons.map((l, i) => (
                <li key={l.id}>
                  <Link
                    href={
                      c.is_enrolled || isOwner || isAdmin
                        ? `/courses/${c.id}/lessons/${l.id}`
                        : "#"
                    }
                    onClick={(e) => {
                      if (!c.is_enrolled && !isOwner && !isAdmin) {
                        e.preventDefault();
                        router.push(`/courses/${c.id}`);
                      }
                    }}
                    className="group flex items-center gap-4 bg-atom-deep/40 px-4 py-3 transition hover:bg-atom-deep/70"
                  >
                    <span className="w-6 text-center text-xs font-mono text-atom-muted">{i + 1}</span>
                    {l.completed ? (
                      <CheckCircle2 className="h-5 w-5 flex-none text-atom-accent" />
                    ) : (
                      <Circle className="h-5 w-5 flex-none text-atom-muted" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-atom-text group-hover:text-atom-accent">
                        {l.title}
                      </p>
                      {l.summary && <p className="line-clamp-1 text-xs text-atom-muted">{l.summary}</p>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-atom-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {l.estimated_minutes}m
                      </span>
                      {l.has_quiz && <Badge variant="accent">Quiz</Badge>}
                      {(c.is_enrolled || isOwner || isAdmin) && (
                        <PlayCircle className="h-4 w-4 text-atom-muted group-hover:text-atom-accent" />
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="inline-flex items-center gap-1.5 text-atom-muted">
        {icon}
        {label}
      </span>
      <span className="font-semibold text-atom-text">{value}</span>
    </div>
  );
}
