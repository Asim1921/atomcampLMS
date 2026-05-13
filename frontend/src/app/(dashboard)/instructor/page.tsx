"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Mail } from "lucide-react";
import { useState } from "react";

import { apiGet, apiPost } from "@/lib/api";
import type { AtRiskRow, LearnerSummary } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function InstructorDashboardPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<AtRiskRow | null>(null);
  const [draft, setDraft] = useState("");

  const atRisk = useQuery({
    queryKey: ["at-risk"],
    queryFn: () => apiGet<AtRiskRow[]>("/api/instructor/at-risk"),
  });

  const learners = useQuery({
    queryKey: ["learners"],
    queryFn: () => apiGet<LearnerSummary[]>("/api/learners"),
  });

  const chartData =
    learners.data?.slice(0, 12).map((L) => ({
      name: L.name.split(" ")[0] ?? L.name,
      quiz: L.quiz_avg,
      risk: Math.round(L.at_risk_score * 100),
    })) ?? [];

  const intervene = useMutation({
    mutationFn: (learnerId: string) =>
      apiPost<{ message: string }>("/api/instructor/intervene", { learner_id: learnerId }),
    onSuccess: (data) => {
      setDraft(data.message);
      qc.invalidateQueries({ queryKey: ["at-risk"] });
    },
  });

  function openDraft(row: AtRiskRow) {
    setActive(row);
    setDraft("");
    setOpen(true);
    intervene.mutate(row.learner_id);
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold tracking-tight text-atom-text sm:text-3xl">Instructor command center</h2>
        <p className="mt-1 max-w-2xl break-words text-sm text-atom-muted">
          At-risk scores from a trained scikit-learn LogisticRegression on engagement features (artifact:{" "}
          <code className="break-all rounded bg-atom-panel px-1">ml/artifacts/risk_model.pkl</code>). Interventions combine DNA +
          risk context for an LLM-generated draft message.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Engagement vs risk (sample)</CardTitle>
            <CardDescription>First 12 learners — quiz score and modeled risk %.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {learners.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                  <XAxis dataKey="name" tick={{ fill: "#8ba3be", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8ba3be", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#111f33", border: "1px solid #1e3a5f", borderRadius: 8 }}
                    labelStyle={{ color: "#e8f1fc" }}
                  />
                  <Bar dataKey="quiz" fill="#38bdf8" name="Quiz avg" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="risk" fill="#2dd4bf" name="Risk %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-atom-warn" />
              Class roster — risk ranked
            </CardTitle>
            <CardDescription>Higher score → higher modeled struggle / churn probability.</CardDescription>
          </CardHeader>
          <CardContent>
            {atRisk.isLoading && <Skeleton className="h-48 w-full" />}
            <div className="max-h-[340px] overflow-y-auto rounded-xl border border-atom-border/60">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="sticky top-0 bg-atom-deep/95 text-atom-muted backdrop-blur">
                  <tr>
                    <th className="px-3 py-2 font-medium">Learner</th>
                    <th className="px-3 py-2 font-medium">Goal</th>
                    <th className="px-3 py-2 font-medium">Risk</th>
                    <th className="px-3 py-2 font-medium">AI</th>
                  </tr>
                </thead>
                <tbody>
                  {atRisk.data?.map((row) => (
                    <tr key={row.learner_id} className="border-t border-atom-border/40 hover:bg-atom-deep/30">
                      <td className="px-3 py-2 font-medium text-atom-text">{row.name}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-atom-muted">{row.goal}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row.at_risk_score >= 0.45 ? "danger" : "accent"}>
                          {(row.at_risk_score * 100).toFixed(0)}%
                        </Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="outline" onClick={() => openDraft(row)}>
                          <Mail className="h-3 w-3" /> Draft
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Intervention draft {active ? `— ${active.name}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 px-6 pb-6">
            {intervene.isPending && <Skeleton className="h-32 w-full" />}
            <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg bg-atom-deep/80 p-4 text-sm text-atom-text">
              {draft || (intervene.isPending ? "" : "No content")}
            </pre>
            <div className="flex gap-2">
              <Button variant="default" onClick={() => draft && navigator.clipboard.writeText(draft)} disabled={!draft}>
                <Copy className="h-4 w-4" /> Copy
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
