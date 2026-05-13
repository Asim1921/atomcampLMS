import type { AuthUser } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "atomadapt.token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function unwrap<T>(res: Response, path: string): Promise<T> {
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: string | { msg?: string }[] };
      if (Array.isArray(body?.detail)) {
        detail = body.detail.map((d) => (typeof d === "string" ? d : d?.msg ?? "")).join("; ");
      } else if (typeof body?.detail === "string") {
        detail = body.detail;
      }
    } catch {
      /* swallow JSON parse errors */
    }
    throw new Error(detail || `${path}: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    cache: "no-store",
    headers: { ...authHeaders() },
  });
  return unwrap<T>(res, path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return unwrap<T>(res, path);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return unwrap<T>(res, path);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return unwrap<T>(res, path);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API}${path}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok && res.status !== 204) {
    let detail = "";
    try {
      const body = (await res.json()) as { detail?: string };
      detail = typeof body?.detail === "string" ? body.detail : "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `${path}: ${res.status}`);
  }
}

export async function apiPostAvatar(file: File): Promise<AuthUser> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API}/api/profile/avatar`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: fd,
  });
  return unwrap<AuthUser>(res, "/api/profile/avatar");
}

export async function tutorStream(
  learnerId: string,
  message: string,
  onChunk: (s: string) => void,
): Promise<void> {
  const res = await fetch(`${API}/api/tutor/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ learner_id: learnerId, message }),
  });
  if (!res.ok || !res.body) throw new Error("Tutor request failed");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(dec.decode(value, { stream: true }));
  }
}

export { API };
