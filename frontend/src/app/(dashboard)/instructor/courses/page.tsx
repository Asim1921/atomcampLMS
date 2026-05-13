"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type { CourseSummary } from "@/lib/types";

export default function InstructorCoursesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const becomeInstructor = useAuthStore((s) => s.becomeInstructor);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  const courses = useQuery({
    queryKey: ["my-courses"],
    queryFn: () => apiGet<CourseSummary[]>("/api/courses?mine=true&include_unpublished=true"),
    enabled: isInstructor,
  });

  const togglePublish = useMutation({
    mutationFn: (c: CourseSummary) =>
      apiPut(`/api/courses/${c.id}`, { published: !c.published }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-courses"] }),
  });

  const [confirmDelete, setConfirmDelete] = useState<CourseSummary | null>(null);
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/courses/${id}`),
    onSuccess: () => {
      setConfirmDelete(null);
      void qc.invalidateQueries({ queryKey: ["my-courses"] });
      void qc.invalidateQueries({ queryKey: ["courses"] });
    },
  });

  useEffect(() => {
    setPromoteError(null);
  }, [isInstructor]);

  if (!isInstructor) {
    return (
      <div className="mx-auto max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-atom-accent" />
              Author courses on AtomAdapt
            </CardTitle>
            <CardDescription>
              Become an instructor to publish your own bootcamps, add lessons, and ship quizzes
              that feed directly into the Learner DNA model.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2 text-sm text-atom-muted">
              <li>· Create unlimited courses with rich markdown lessons</li>
              <li>· Auto-graded MCQ quizzes that update each learner&apos;s DNA</li>
              <li>· Real-time enrollment + progress dashboards (coming next)</li>
            </ul>
            {promoteError && <p className="text-sm text-atom-danger">{promoteError}</p>}
            <Button
              className="w-full"
              disabled={promoting}
              onClick={async () => {
                setPromoteError(null);
                setPromoting(true);
                try {
                  await becomeInstructor();
                  router.refresh();
                } catch (err) {
                  setPromoteError(err instanceof Error ? err.message : "Failed to promote.");
                } finally {
                  setPromoting(false);
                }
              }}
            >
              {promoting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Become an instructor"}
            </Button>
            <p className="text-[11px] text-atom-muted">
              Demo-grade promotion — in production this would require admin approval or verification.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">Instructor</p>
          <h2 className="text-2xl font-bold tracking-tight text-atom-text sm:text-3xl">Your courses</h2>
          <p className="mt-1 max-w-2xl text-sm text-atom-muted">
            Publish, edit, and track your own bootcamps. Quizzes here feed every learner&apos;s DNA quiz_avg.
          </p>
        </div>
        <Button asChild>
          <Link href="/instructor/courses/new">
            <Plus className="h-4 w-4" /> New course
          </Link>
        </Button>
      </div>

      {courses.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (courses.data?.length ?? 0) === 0 ? (
        <div className="rounded-2xl border border-dashed border-atom-border/60 bg-atom-panel/40 p-12 text-center">
          <p className="text-sm text-atom-muted">You haven&apos;t authored any courses yet.</p>
          <Button asChild className="mt-4">
            <Link href="/instructor/courses/new">
              <Plus className="h-4 w-4" /> Create your first course
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.data?.map((c) => (
            <Card key={c.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xl">
                    <span>{c.cover_emoji}</span>
                    <Badge variant="outline">{c.level}</Badge>
                    {c.published ? (
                      <Badge variant="accent">live</Badge>
                    ) : (
                      <Badge variant="warn">draft</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-2 text-base">{c.title}</CardTitle>
                  <CardDescription className="line-clamp-2">{c.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-xs text-atom-muted">
                  <span>{c.lesson_count} lessons</span>
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {c.enrolled_count} enrolled
                  </span>
                  <span>{c.duration_hours}h</span>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/instructor/courses/${c.id}`}>
                      <Pencil className="h-3 w-3" /> Manage
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => togglePublish.mutate(c)}
                    disabled={togglePublish.isPending}
                  >
                    {c.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {c.published ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => setConfirmDelete(c)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this course?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-6 text-sm text-atom-muted">
            <p>
              You&apos;re about to permanently delete{" "}
              <span className="text-atom-text">{confirmDelete?.title}</span>, all its lessons,
              quizzes, enrollments, and attempt history. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button
                variant="danger"
                className="flex-1"
                onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
                disabled={deleteMut.isPending}
              >
                {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete forever"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
