"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { CourseDetail, LessonDetail } from "@/lib/types";

export default function InstructorCourseEditorPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const router = useRouter();
  const qc = useQueryClient();

  const course = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => apiGet<CourseDetail>(`/api/courses/${courseId}`),
    enabled: !!courseId,
  });

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedLessonId && course.data?.lessons.length) {
      setSelectedLessonId(course.data.lessons[0].id);
    }
  }, [course.data, selectedLessonId]);

  // --- course meta state ---
  const [meta, setMeta] = useState({
    title: "",
    description: "",
    audience: "",
    duration_hours: 6,
    level: "beginner",
    tags: "",
    cover_emoji: "📘",
  });
  const [metaDirty, setMetaDirty] = useState(false);

  useEffect(() => {
    if (course.data) {
      setMeta({
        title: course.data.title,
        description: course.data.description,
        audience: course.data.audience,
        duration_hours: course.data.duration_hours,
        level: course.data.level,
        tags: course.data.tags.join(", "),
        cover_emoji: course.data.cover_emoji,
      });
      setMetaDirty(false);
    }
  }, [course.data]);

  const saveMeta = useMutation({
    mutationFn: () =>
      apiPut(`/api/courses/${courseId}`, {
        ...meta,
        tags: meta.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      setMetaDirty(false);
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
      void qc.invalidateQueries({ queryKey: ["my-courses"] });
    },
  });

  const togglePublish = useMutation({
    mutationFn: () =>
      apiPut(`/api/courses/${courseId}`, { published: !course.data?.published }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
      void qc.invalidateQueries({ queryKey: ["my-courses"] });
    },
  });

  const addLesson = useMutation({
    mutationFn: () =>
      apiPost(`/api/courses/${courseId}/lessons`, {
        title: "Untitled lesson",
        summary: "",
        content_md: "# New lesson\n\nStart writing here…",
        estimated_minutes: 15,
      }),
    onSuccess: (data) => {
      const lesson = data as { id: string };
      setSelectedLessonId(lesson.id);
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
    },
  });

  const deleteCourse = useMutation({
    mutationFn: () => apiDelete(`/api/courses/${courseId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["my-courses"] });
      router.replace("/instructor/courses");
    },
  });

  const moveLesson = useMutation({
    mutationFn: (items: { id: string; order_index: number }[]) =>
      apiPut(`/api/courses/${courseId}/lessons/order`, { items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["course", courseId] }),
  });

  function reorder(direction: -1 | 1, lessonId: string) {
    if (!course.data) return;
    const list = [...course.data.lessons];
    const i = list.findIndex((l) => l.id === lessonId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    moveLesson.mutate(list.map((l, idx) => ({ id: l.id, order_index: idx })));
  }

  if (course.isLoading || !course.data) {
    return <Skeleton className="h-[80vh] w-full" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/instructor/courses">
            <ArrowLeft className="h-4 w-4" /> Back to my courses
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {course.data.published ? (
            <Badge variant="accent">live</Badge>
          ) : (
            <Badge variant="warn">draft</Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => togglePublish.mutate()}>
            {course.data.published ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {course.data.published ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/courses/${courseId}`}>
              <Eye className="h-3 w-3" /> Preview
            </Link>
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm("Delete this course and all its lessons/quizzes/enrollments?")) {
                deleteCourse.mutate();
              }
            }}
          >
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-2xl">{meta.cover_emoji}</span> Course details
          </CardTitle>
          <CardDescription>Used in the catalog card and the public course page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Title"
            value={meta.title}
            onChange={(e) => {
              setMeta((m) => ({ ...m, title: e.target.value }));
              setMetaDirty(true);
            }}
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr]">
            <div>
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">Level</span>
              <select
                className="h-11 w-full rounded-xl border border-atom-border/80 bg-atom-deep/70 px-3 text-sm text-atom-text"
                value={meta.level}
                onChange={(e) => {
                  setMeta((m) => ({ ...m, level: e.target.value }));
                  setMetaDirty(true);
                }}
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
              value={String(meta.duration_hours)}
              onChange={(e) => {
                setMeta((m) => ({ ...m, duration_hours: Number(e.target.value) || 1 }));
                setMetaDirty(true);
              }}
            />
            <Field
              label="Tags (comma-separated)"
              value={meta.tags}
              onChange={(e) => {
                setMeta((m) => ({ ...m, tags: e.target.value }));
                setMetaDirty(true);
              }}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">Description</span>
            <textarea
              className="min-h-[80px] w-full rounded-xl border border-atom-border/80 bg-atom-deep/70 p-3 text-sm text-atom-text focus:border-atom-accent/60 focus:outline-none"
              value={meta.description}
              onChange={(e) => {
                setMeta((m) => ({ ...m, description: e.target.value }));
                setMetaDirty(true);
              }}
            />
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">Audience</span>
            <textarea
              className="min-h-[60px] w-full rounded-xl border border-atom-border/80 bg-atom-deep/70 p-3 text-sm text-atom-text focus:border-atom-accent/60 focus:outline-none"
              value={meta.audience}
              onChange={(e) => {
                setMeta((m) => ({ ...m, audience: e.target.value }));
                setMetaDirty(true);
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-atom-muted">{course.data.enrolled_count} learner(s) enrolled</p>
            <Button onClick={() => saveMeta.mutate()} disabled={!metaDirty || saveMeta.isPending}>
              {saveMeta.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save details
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Lessons</CardTitle>
            <Button size="sm" onClick={() => addLesson.mutate()} disabled={addLesson.isPending}>
              <Plus className="h-3 w-3" /> Add
            </Button>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            {course.data.lessons.length === 0 ? (
              <p className="px-1 text-xs text-atom-muted">No lessons yet.</p>
            ) : (
              <ol className="space-y-1">
                {course.data.lessons.map((l, i) => (
                  <li
                    key={l.id}
                    className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition ${
                      selectedLessonId === l.id
                        ? "bg-atom-accent/10 text-atom-accent"
                        : "text-atom-muted hover:bg-atom-deep/40 hover:text-atom-text"
                    }`}
                  >
                    <button
                      className="flex-1 cursor-pointer truncate text-left"
                      onClick={() => setSelectedLessonId(l.id)}
                    >
                      <span className="font-mono text-[10px] text-atom-muted/80">{i + 1}.</span>{" "}
                      {l.title}
                    </button>
                    {l.has_quiz && <Badge variant="outline" className="text-[9px]">Q</Badge>}
                    <button
                      title="Move up"
                      className="rounded p-0.5 opacity-0 hover:bg-atom-deep group-hover:opacity-100"
                      onClick={() => reorder(-1, l.id)}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      title="Move down"
                      className="rounded p-0.5 opacity-0 hover:bg-atom-deep group-hover:opacity-100"
                      onClick={() => reorder(1, l.id)}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {selectedLessonId && (
          <LessonEditor
            key={selectedLessonId}
            courseId={courseId}
            lessonId={selectedLessonId}
            onDeleted={() => {
              setSelectedLessonId(null);
              void qc.invalidateQueries({ queryKey: ["course", courseId] });
            }}
          />
        )}
      </div>
    </div>
  );
}

function LessonEditor({
  courseId,
  lessonId,
  onDeleted,
}: {
  courseId: string;
  lessonId: string;
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const lesson = useQuery({
    queryKey: ["lesson", courseId, lessonId],
    queryFn: () => apiGet<LessonDetail>(`/api/courses/${courseId}/lessons/${lessonId}`),
  });

  const [form, setForm] = useState({
    title: "",
    summary: "",
    content_md: "",
    estimated_minutes: 15,
    video_url: "",
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (lesson.data) {
      setForm({
        title: lesson.data.title,
        summary: lesson.data.summary,
        content_md: lesson.data.content_md,
        estimated_minutes: lesson.data.estimated_minutes,
        video_url: lesson.data.video_url ?? "",
      });
      setDirty(false);
    }
  }, [lesson.data]);

  const save = useMutation({
    mutationFn: () =>
      apiPut(`/api/courses/${courseId}/lessons/${lessonId}`, {
        ...form,
        video_url: form.video_url.trim() || null,
      }),
    onSuccess: () => {
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["lesson", courseId, lessonId] });
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
    },
  });

  const del = useMutation({
    mutationFn: () => apiDelete(`/api/courses/${courseId}/lessons/${lessonId}`),
    onSuccess: () => onDeleted(),
  });

  if (lesson.isLoading || !lesson.data) {
    return <Skeleton className="h-[60vh]" />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Edit lesson</CardTitle>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm("Delete this lesson and its quiz?")) del.mutate();
            }}
          >
            <Trash2 className="h-3 w-3" /> Delete lesson
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            label="Title"
            value={form.title}
            onChange={(e) => {
              setForm((f) => ({ ...f, title: e.target.value }));
              setDirty(true);
            }}
          />
          <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
            <Field
              label="Summary"
              value={form.summary}
              onChange={(e) => {
                setForm((f) => ({ ...f, summary: e.target.value }));
                setDirty(true);
              }}
            />
            <Field
              label="Est. minutes"
              type="number"
              min={1}
              value={String(form.estimated_minutes)}
              onChange={(e) => {
                setForm((f) => ({ ...f, estimated_minutes: Number(e.target.value) || 1 }));
                setDirty(true);
              }}
            />
          </div>
          <Field
            label="Video URL (YouTube/Vimeo embed)"
            value={form.video_url}
            onChange={(e) => {
              setForm((f) => ({ ...f, video_url: e.target.value }));
              setDirty(true);
            }}
            hint="Optional. Use an /embed/ URL. Leave blank to skip."
          />
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-atom-muted">
              Content (Markdown)
            </span>
            <textarea
              className="min-h-[260px] w-full rounded-xl border border-atom-border/80 bg-atom-deep/70 p-3 font-mono text-sm text-atom-text focus:border-atom-accent/60 focus:outline-none"
              value={form.content_md}
              onChange={(e) => {
                setForm((f) => ({ ...f, content_md: e.target.value }));
                setDirty(true);
              }}
            />
            <p className="mt-1 text-[10px] text-atom-muted/80">
              Supports headings (#), lists, **bold**, *italic*, `code`, and ```fenced``` blocks.
            </p>
          </div>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save lesson
          </Button>
        </CardContent>
      </Card>

      <QuizEditor lessonId={lessonId} hasQuiz={lesson.data.has_quiz} courseId={courseId} />
    </div>
  );
}

type LocalChoice = { id: string; text: string };
type LocalQuestion = {
  prompt: string;
  choices: LocalChoice[];
  correct_choice_id: string;
};

function emptyQuestion(): LocalQuestion {
  return {
    prompt: "",
    choices: [
      { id: "a", text: "" },
      { id: "b", text: "" },
      { id: "c", text: "" },
      { id: "d", text: "" },
    ],
    correct_choice_id: "a",
  };
}

function QuizEditor({
  lessonId,
  hasQuiz,
  courseId,
}: {
  lessonId: string;
  hasQuiz: boolean;
  courseId: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("Lesson check");
  const [passing, setPassing] = useState(70);
  const [questions, setQuestions] = useState<LocalQuestion[]>([emptyQuestion()]);
  const [loaded, setLoaded] = useState(false);

  const existing = useQuery({
    queryKey: ["quiz-author", lessonId],
    queryFn: async () => {
      if (!hasQuiz) return null;
      // Authors get the full payload back
      return apiGet<{
        id: string;
        title: string;
        passing_score: number;
        questions: { prompt: string; choices: LocalChoice[]; correct_choice_id: string }[];
      }>(`/api/lessons/${lessonId}/quiz`);
    },
  });

  useEffect(() => {
    if (existing.data && !loaded) {
      setTitle(existing.data.title);
      setPassing(existing.data.passing_score);
      setQuestions(
        existing.data.questions.map((q) => ({
          prompt: q.prompt,
          choices: q.choices,
          correct_choice_id: q.correct_choice_id,
        })),
      );
      setLoaded(true);
    } else if (!hasQuiz && !loaded) {
      setLoaded(true);
    }
  }, [existing.data, hasQuiz, loaded]);

  const saveQuiz = useMutation({
    mutationFn: () =>
      apiPut(`/api/lessons/${lessonId}/quiz`, {
        title,
        passing_score: passing,
        questions: questions.map((q) => ({
          prompt: q.prompt,
          choices: q.choices,
          correct_choice_id: q.correct_choice_id,
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["lesson", courseId, lessonId] });
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
      void qc.invalidateQueries({ queryKey: ["quiz-author", lessonId] });
    },
  });

  const deleteQuiz = useMutation({
    mutationFn: () => apiDelete(`/api/lessons/${lessonId}/quiz`),
    onSuccess: () => {
      setQuestions([emptyQuestion()]);
      setTitle("Lesson check");
      setPassing(70);
      void qc.invalidateQueries({ queryKey: ["lesson", courseId, lessonId] });
      void qc.invalidateQueries({ queryKey: ["course", courseId] });
      void qc.invalidateQueries({ queryKey: ["quiz-author", lessonId] });
    },
  });

  const canSave =
    questions.length > 0 &&
    questions.every(
      (q) =>
        q.prompt.trim().length > 0 &&
        q.choices.length >= 2 &&
        q.choices.every((c) => c.text.trim().length > 0) &&
        q.choices.some((c) => c.id === q.correct_choice_id),
    );

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4 text-atom-accent" /> Lesson quiz
          </CardTitle>
          <CardDescription>
            Multiple-choice. Passing a quiz auto-completes the lesson and feeds Learner DNA{" "}
            <code className="rounded bg-atom-deep px-1 text-[10px]">quiz_avg</code>.
          </CardDescription>
        </div>
        {hasQuiz && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (confirm("Delete this quiz?")) deleteQuiz.mutate();
            }}
          >
            <Trash2 className="h-3 w-3" /> Delete quiz
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
          <Field label="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <Field
            label="Passing score (%)"
            type="number"
            min={0}
            max={100}
            value={String(passing)}
            onChange={(e) => setPassing(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
          />
        </div>

        {questions.map((q, idx) => (
          <div key={idx} className="rounded-2xl border border-atom-border/60 bg-atom-deep/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-atom-muted">
                Question {idx + 1}
              </span>
              <button
                className="text-xs text-atom-danger hover:underline"
                onClick={() => setQuestions((qs) => qs.filter((_, i) => i !== idx))}
                disabled={questions.length === 1}
              >
                Remove
              </button>
            </div>
            <textarea
              className="mt-2 min-h-[60px] w-full rounded-lg border border-atom-border/60 bg-atom-deep/70 p-2 text-sm text-atom-text focus:border-atom-accent/60 focus:outline-none"
              placeholder="Question prompt"
              value={q.prompt}
              onChange={(e) =>
                setQuestions((qs) => qs.map((qq, i) => (i === idx ? { ...qq, prompt: e.target.value } : qq)))
              }
            />
            <div className="mt-2 space-y-1.5">
              {q.choices.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setQuestions((qs) =>
                        qs.map((qq, i) => (i === idx ? { ...qq, correct_choice_id: c.id } : qq)),
                      )
                    }
                    title="Mark as correct answer"
                    className={`grid h-7 w-7 flex-none place-items-center rounded-full border text-xs font-bold transition ${
                      q.correct_choice_id === c.id
                        ? "border-atom-accent bg-atom-accent text-atom-deep"
                        : "border-atom-border text-atom-muted hover:border-atom-accent/50"
                    }`}
                  >
                    {q.correct_choice_id === c.id ? <CheckCircle2 className="h-3.5 w-3.5" /> : c.id.toUpperCase()}
                  </button>
                  <input
                    className="h-9 flex-1 rounded-lg border border-atom-border/60 bg-atom-deep/70 px-2 text-sm text-atom-text focus:border-atom-accent/60 focus:outline-none"
                    placeholder={`Choice ${c.id.toUpperCase()}`}
                    value={c.text}
                    onChange={(e) =>
                      setQuestions((qs) =>
                        qs.map((qq, i) =>
                          i === idx
                            ? {
                                ...qq,
                                choices: qq.choices.map((cc) =>
                                  cc.id === c.id ? { ...cc, text: e.target.value } : cc,
                                ),
                              }
                            : qq,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}>
            <Plus className="h-4 w-4" /> Add question
          </Button>
          <Button onClick={() => saveQuiz.mutate()} disabled={!canSave || saveQuiz.isPending}>
            {saveQuiz.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {hasQuiz ? "Update quiz" : "Create quiz"}
          </Button>
        </div>
        {!canSave && (
          <p className="text-[11px] text-atom-muted">
            Each question needs a prompt and all choice texts filled. Click the letter button to mark the correct
            answer.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
