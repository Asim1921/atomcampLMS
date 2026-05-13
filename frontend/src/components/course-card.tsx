"use client";

import { BookOpen, Clock, Users } from "lucide-react";
import Link from "next/link";

import type { CourseSummary } from "@/lib/types";

import { Badge } from "./ui/badge";

type Props = {
  course: CourseSummary;
  href?: string;
};

export function CourseCard({ course, href }: Props) {
  const link = href ?? `/courses/${course.id}`;
  return (
    <Link
      href={link}
      className="group flex flex-col overflow-hidden rounded-2xl border border-atom-border/60 bg-atom-panel/60 transition hover:border-atom-accent/40 hover:shadow-glow"
    >
      <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-atom-accent/10 via-atom-panel to-cyan-500/10 text-5xl">
        <span className="drop-shadow-md">{course.cover_emoji}</span>
        {!course.published && (
          <span className="absolute right-3 top-3 rounded-md border border-atom-warn/40 bg-atom-warn/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-atom-warn">
            Draft
          </span>
        )}
        {course.is_enrolled && (
          <span className="absolute left-3 top-3 rounded-md border border-atom-accent/40 bg-atom-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-atom-accent">
            Enrolled
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-atom-muted">
          <Badge variant="outline">{course.level}</Badge>
          {course.owner_name && <span className="truncate">by {course.owner_name}</span>}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-atom-text group-hover:text-atom-accent">
          {course.title}
        </h3>
        <p className="line-clamp-2 text-xs text-atom-muted">{course.description}</p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-atom-muted">
          <span className="inline-flex items-center gap-1">
            <BookOpen className="h-3 w-3" /> {course.lesson_count} lesson{course.lesson_count === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {course.duration_hours}h
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> {course.enrolled_count}
          </span>
        </div>

        {course.is_enrolled && (
          <div className="mt-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-atom-border/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-atom-accent to-cyan-500"
                style={{ width: `${course.progress_pct}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-atom-muted">{course.progress_pct}% complete</p>
          </div>
        )}
      </div>
    </Link>
  );
}
