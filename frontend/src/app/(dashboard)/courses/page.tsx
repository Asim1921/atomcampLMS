"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { CourseCard } from "@/components/course-card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type { CourseSummary } from "@/lib/types";

const LEVELS = ["all", "beginner", "intermediate", "advanced"] as const;

export default function CatalogPage() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("all");
  const [onlyEnrolled, setOnlyEnrolled] = useState(false);

  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: () => apiGet<CourseSummary[]>("/api/courses"),
  });

  const filtered = useMemo(() => {
    const list = courses.data ?? [];
    const q = search.trim().toLowerCase();
    return list.filter((c) => {
      if (level !== "all" && c.level !== level) return false;
      if (onlyEnrolled && !c.is_enrolled) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [courses.data, search, level, onlyEnrolled]);

  const isInstructor = user?.role === "instructor" || user?.role === "admin";

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">Catalog</p>
          <h2 className="text-2xl font-bold tracking-tight text-atom-text sm:text-3xl">
            Browse all courses
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-atom-muted">
            Hand-curated bootcamps and learner-created tracks. Enroll and your progress feeds your Learner DNA.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {isInstructor && (
            <Button asChild className="w-full sm:w-auto">
              <Link href="/instructor/courses/new">
                <Plus className="h-4 w-4" /> New course
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/me/learning">
              <BookOpen className="h-4 w-4" /> My learning
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
        <Field
          label="Search"
          placeholder="Search by title, topic, tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search className="h-4 w-4" />}
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-atom-muted">Level</span>
          <div className="flex h-11 items-center gap-1 overflow-x-auto rounded-xl border border-atom-border/80 bg-atom-deep/70 p-1 scrollbar-thin">
            {LEVELS.map((l) => (
              <button
                key={l}
                onClick={() => setLevel(l)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs capitalize transition ${
                  level === l
                    ? "bg-atom-accent text-atom-deep"
                    : "text-atom-muted hover:text-atom-text"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-atom-muted">Filter</span>
          <button
            onClick={() => setOnlyEnrolled((v) => !v)}
            className={`flex h-11 w-full items-center justify-center rounded-xl border px-4 text-sm transition sm:w-auto sm:justify-start ${
              onlyEnrolled
                ? "border-atom-accent/50 bg-atom-accent/10 text-atom-accent"
                : "border-atom-border/80 bg-atom-deep/70 text-atom-muted hover:text-atom-text"
            }`}
          >
            Enrolled only
          </button>
        </div>
      </div>

      {courses.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-atom-border/60 bg-atom-panel/40 p-12 text-center">
          <p className="text-sm text-atom-muted">No courses match those filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
