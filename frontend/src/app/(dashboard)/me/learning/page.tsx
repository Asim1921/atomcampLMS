"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";

import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import type { CourseSummary } from "@/lib/types";

export default function MyLearningPage() {
  const enrollments = useQuery({
    queryKey: ["my-learning"],
    queryFn: () => apiGet<CourseSummary[]>("/api/me/enrollments"),
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">My learning</p>
          <h2 className="text-2xl font-bold tracking-tight text-atom-text sm:text-3xl">Enrolled courses</h2>
          <p className="mt-1 max-w-2xl text-sm text-atom-muted">
            Pick up where you left off. Progress feeds your Learner DNA and improves AI recommendations.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/courses">
            <BookOpen className="h-4 w-4" /> Browse catalog
          </Link>
        </Button>
      </div>

      {enrollments.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (enrollments.data?.length ?? 0) === 0 ? (
        <div className="rounded-3xl border border-dashed border-atom-border/60 bg-atom-panel/40 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-atom-accent" />
          <p className="mt-3 text-sm text-atom-text">You haven&apos;t enrolled yet.</p>
          <p className="mt-1 text-sm text-atom-muted">
            Head to the catalog and pick a course that matches your goal.
          </p>
          <Button asChild className="mt-4">
            <Link href="/courses">Browse catalog</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {enrollments.data?.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
