"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { apiGet } from "@/lib/api";
import type { AdminSummary, LearnerSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminDashboardPage() {
  const summary = useQuery({
    queryKey: ["admin-summary"],
    queryFn: () => apiGet<AdminSummary>("/api/admin/summary"),
  });

  const learners = useQuery({
    queryKey: ["learners"],
    queryFn: () => apiGet<LearnerSummary[]>("/api/learners"),
  });

  const spark =
    learners.data?.slice(0, 14).map((L, i) => ({
      week: `W${i + 1}`,
      cohort: 40 + (L.quiz_avg % 35) + i,
    })) ?? [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-atom-text sm:text-3xl">Admin analytics</h2>
        <p className="mt-1 max-w-2xl break-words text-sm text-atom-muted">
          Cohort metrics derived from the SQLite learner store. Weekly insight card uses an LLM when{" "}
          <code className="break-all rounded bg-atom-panel px-1">OPENAI_API_KEY</code> is set; otherwise a structured fallback
          summary is shown (still demo-safe).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {summary.isLoading ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            <Stat label="Learners" value={summary.data?.learner_count ?? 0} icon={<Users className="h-4 w-4" />} />
            <Stat label="Avg quiz" value={summary.data?.avg_quiz ?? 0} icon={<Activity className="h-4 w-4" />} />
            <Stat label="Avg logins / 14d" value={summary.data?.avg_logins ?? 0} />
            <Stat label="At-risk (est.)" value={summary.data?.at_risk_count ?? 0} accent />
          </>
        )}
      </div>

      <Card className="border-atom-accent/25 bg-atom-panel/60">
        <CardHeader>
          <CardTitle>Weekly insight</CardTitle>
          <CardDescription>LLM-generated narrative for program leads (atomcamp-style ops review).</CardDescription>
        </CardHeader>
        <CardContent>
          {summary.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-xl bg-atom-deep/60 p-5 text-sm leading-relaxed text-atom-text">
              {summary.data?.weekly_insight}
            </pre>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Cohort completion curve (illustrative)</CardTitle>
            <CardDescription>Synthetic sparkline from learner quiz variance — for dashboard polish.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark}>
                <defs>
                  <linearGradient id="fillCohort" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="week" tick={{ fill: "#8ba3be", fontSize: 11 }} />
                <YAxis tick={{ fill: "#8ba3be", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#111f33", border: "1px solid #1e3a5f", borderRadius: 8 }}
                  labelStyle={{ color: "#e8f1fc" }}
                />
                <Area type="monotone" dataKey="cohort" stroke="#2dd4bf" fill="url(#fillCohort)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Beginner share</CardTitle>
            <CardDescription>Percent of learners currently tagged beginner-level in DNA.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-10">
            {summary.isLoading ? (
              <Skeleton className="h-20 w-20 rounded-full" />
            ) : (
              <>
                <p className="text-5xl font-black text-atom-accent">{summary.data?.beginner_share ?? 0}%</p>
                <Badge variant="outline">avg confidence {(summary.data?.avg_confidence ?? 0).toFixed(2)}</Badge>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? "border-atom-danger/40 bg-atom-danger/5" : "border-atom-border/60 bg-atom-deep/40"
      }`}
    >
      <div className="flex items-center justify-between text-atom-muted">
        <span className="text-xs uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-bold text-atom-text">{value}</p>
    </div>
  );
}
