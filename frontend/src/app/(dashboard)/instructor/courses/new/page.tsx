"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { apiPost } from "@/lib/api";
import type { CourseSummary } from "@/lib/types";

const EMOJIS = ["📘", "🧠", "📈", "📊", "🎨", "⚙️", "🌐", "📱", "☁️", "🖌️", "🗃️", "🤖", "🧪", "🚀"];

export default function NewCoursePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [level, setLevel] = useState("beginner");
  const [tags, setTags] = useState("");
  const [emoji, setEmoji] = useState("📘");
  const [hours, setHours] = useState("6");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const course = await apiPost<CourseSummary>("/api/courses", {
        title: title.trim(),
        description: description.trim(),
        audience: audience.trim(),
        level,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        cover_emoji: emoji,
        duration_hours: Number(hours) || 6,
        published: false,
      });
      router.replace(`/instructor/courses/${course.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create course.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-atom-accent">Instructor</p>
        <h2 className="text-2xl font-bold tracking-tight text-atom-text sm:text-3xl">New course</h2>
        <p className="mt-1 text-sm text-atom-muted">
          Start with a shell, then add lessons and quizzes. You can keep it as a draft until you&apos;re ready to publish.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <Field
              label="Title"
              required
              placeholder="e.g. Production-Grade GenAI with RAG"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">Cover emoji</span>
              <div className="flex flex-wrap gap-1">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={`grid h-10 w-10 place-items-center rounded-lg border text-xl transition ${
                      emoji === e
                        ? "border-atom-accent/60 bg-atom-accent/10"
                        : "border-atom-border/60 bg-atom-deep/50 hover:border-atom-accent/30"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">Description</span>
              <textarea
                className="min-h-[100px] w-full rounded-xl border border-atom-border/80 bg-atom-deep/70 p-3 text-sm text-atom-text focus:border-atom-accent/60 focus:outline-none"
                placeholder="A short overview that learners will see in the catalog."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">Audience</span>
              <textarea
                className="min-h-[70px] w-full rounded-xl border border-atom-border/80 bg-atom-deep/70 p-3 text-sm text-atom-text focus:border-atom-accent/60 focus:outline-none"
                placeholder="Who is this for?"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">Level</span>
                <select
                  className="h-11 w-full rounded-xl border border-atom-border/80 bg-atom-deep/70 px-3 text-sm text-atom-text"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                >
                  <option value="beginner">beginner</option>
                  <option value="intermediate">intermediate</option>
                  <option value="advanced">advanced</option>
                </select>
              </div>
              <Field
                label="Duration (hours)"
                type="number"
                min={1}
                max={400}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
              />
              <Field
                label="Tags (comma-separated)"
                placeholder="rag, llm, embeddings"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-atom-danger/40 bg-atom-danger/10 px-3 py-2 text-sm text-atom-danger">
                {error}
              </div>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={pending || !title.trim()} className="flex-1">
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create course"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
