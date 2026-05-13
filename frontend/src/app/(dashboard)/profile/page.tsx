"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiDelete, apiGet, apiPatch, apiPost, apiPostAvatar } from "@/lib/api";
import { useAuthStore } from "@/lib/auth";
import type { AuthUser, CourseSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [interestsText, setInterestsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [favorites, setFavorites] = useState<CourseSummary[]>([]);
  const [catalog, setCatalog] = useState<CourseSummary[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setBio(user.bio ?? "");
    setInterestsText((user.interests ?? []).join("\n"));
  }, [user]);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [fav, courses] = await Promise.all([
        apiGet<CourseSummary[]>("/api/profile/favorites"),
        apiGet<CourseSummary[]>("/api/courses"),
      ]);
      setFavorites(fav);
      setCatalog(courses);
    } catch {
      setFavorites([]);
      setCatalog([]);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const favoriteIds = useMemo(() => new Set(favorites.map((c) => c.id)), [favorites]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const interests = interestsText
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      const updated = await apiPatch<AuthUser>("/api/auth/me", {
        name: name.trim(),
        bio: bio.trim(),
        interests,
      });
      useAuthStore.setState({ user: updated });
      setFeedback({ kind: "ok", text: "Profile saved." });
    } catch (err) {
      setFeedback({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not save profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFeedback(null);
    try {
      const updated = await apiPostAvatar(file);
      useAuthStore.setState({ user: updated });
      setFeedback({ kind: "ok", text: "Avatar updated." });
    } catch (err) {
      setFeedback({
        kind: "err",
        text: err instanceof Error ? err.message : "Upload failed.",
      });
    }
  }

  async function addFavorite(courseId: string) {
    setFeedback(null);
    try {
      await apiPost(`/api/profile/favorites/${courseId}`, {});
      await loadLists();
      await refreshUser();
    } catch (err) {
      setFeedback({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not add favorite.",
      });
    }
  }

  async function removeFavorite(courseId: string) {
    setFeedback(null);
    try {
      await apiDelete(`/api/profile/favorites/${courseId}`);
      await loadLists();
    } catch (err) {
      setFeedback({
        kind: "err",
        text: err instanceof Error ? err.message : "Could not remove favorite.",
      });
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h2 className="text-2xl font-semibold text-atom-text">Profile</h2>
        <p className="mt-1 text-sm text-atom-muted">
          Update how AtomAdapt describes you to the tutor and recommendations engine.
        </p>
      </div>

      {feedback && (
        <p
          className={cn(
            "rounded-lg border px-3 py-2 text-sm",
            feedback.kind === "ok"
              ? "border-atom-accent/40 bg-atom-accent/10 text-atom-text"
              : "border-atom-danger/40 bg-atom-danger/10 text-atom-danger",
          )}
        >
          {feedback.text}
        </p>
      )}

      <section className="rounded-2xl border border-atom-border/60 bg-atom-panel/40 p-6 shadow-inner">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-atom-muted">Avatar</h3>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-atom-border bg-atom-deep">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs text-atom-muted">None</span>
            )}
          </div>
          <div>
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={onAvatarChange} />
            <p className="mt-2 text-xs text-atom-muted">PNG, JPEG, or WebP · max 2 MB</p>
          </div>
        </div>
      </section>

      <form onSubmit={onSaveProfile} className="space-y-5 rounded-2xl border border-atom-border/60 bg-atom-panel/40 p-6 shadow-inner">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-atom-muted">Details</h3>
        <div className="space-y-2">
          <label className="text-xs font-medium text-atom-muted">Display name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-atom-muted">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            className="flex w-full rounded-lg border border-atom-border bg-atom-deep/60 px-3 py-2 text-sm text-atom-text placeholder:text-atom-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atom-accent/40"
            placeholder="A short intro for instructors and peers."
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-atom-muted">Interests (one per line)</label>
          <textarea
            value={interestsText}
            onChange={(e) => setInterestsText(e.target.value)}
            rows={4}
            className="flex w-full rounded-lg border border-atom-border bg-atom-deep/60 px-3 py-2 text-sm text-atom-text placeholder:text-atom-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atom-accent/40"
            placeholder={"e.g. MLOps\nLLM applications"}
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <section className="rounded-2xl border border-atom-border/60 bg-atom-panel/40 p-6 shadow-inner">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-atom-muted">Favorite courses</h3>
          <Link href="/courses" className="text-xs font-medium text-atom-accent hover:underline">
            Open catalog
          </Link>
        </div>
        {loadingLists ? (
          <p className="mt-4 text-sm text-atom-muted">Loading…</p>
        ) : favorites.length === 0 ? (
          <p className="mt-4 text-sm text-atom-muted">No favorites yet. Add some from the list below.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {favorites.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-atom-border/50 bg-atom-deep/40 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-atom-text">
                    <span className="mr-2">{c.cover_emoji}</span>
                    {c.title}
                  </p>
                  <p className="truncate text-xs text-atom-muted">{c.level}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void removeFavorite(c.id)}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-atom-border/60 bg-atom-panel/40 p-6 shadow-inner">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-atom-muted">Add from catalog</h3>
        {loadingLists ? (
          <p className="mt-4 text-sm text-atom-muted">Loading…</p>
        ) : (
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {catalog.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-atom-border/40 px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate text-atom-text">
                  {c.cover_emoji} {c.title}
                </span>
                {favoriteIds.has(c.id) ? (
                  <span className="shrink-0 text-xs text-atom-muted">Saved</span>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => void addFavorite(c.id)}>
                    Save
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
