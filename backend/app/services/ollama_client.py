"""Ollama HTTP client for local LLM calls.

Ollama exposes a tiny REST API at OLLAMA_BASE_URL/api/{generate,chat,tags}. We
only need single-shot completion in two flavours:
  - complete_text  — free-form prose (no schema)
  - complete_json  — JSON-mode (forces the server to return a parseable object)

The 8B llama3.1 model on a laptop CPU can take 30-90s; the timeout is generous
on purpose. Every helper returns None on any failure so the caller can fall
back to deterministic content.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _base_url() -> str | None:
    raw = (settings.ollama_base_url or "").strip()
    if not raw or raw.lower() == "disabled":
        return None
    return raw.rstrip("/")


async def is_available() -> bool:
    """Cheap probe: list local models. Used by services to decide whether to call Ollama at all."""
    base = _base_url()
    if not base:
        return False
    try:
        async with httpx.AsyncClient(timeout=3.0) as c:
            r = await c.get(f"{base}/api/tags")
        return r.status_code == 200
    except (httpx.HTTPError, OSError) as e:
        logger.info("Ollama probe failed: %s", e)
        return False


def _extract_first_json_object(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    s = text.strip()
    # Trim ```json fences if the model wrapped its output despite our instructions.
    s = re.sub(r"^```(?:json)?", "", s).strip()
    s = re.sub(r"```$", "", s).strip()
    # Greedy match to the last '}' so we keep the largest valid candidate.
    m = re.search(r"\{[\s\S]*\}", s)
    if not m:
        return None
    try:
        out = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    return out if isinstance(out, dict) else None


async def complete_text(
    system: str,
    user: str,
    *,
    model: str | None = None,
    temperature: float = 0.4,
    num_predict: int = 1024,
) -> str | None:
    """Non-streaming single-shot completion. Returns None if Ollama is unreachable."""
    base = _base_url()
    if not base:
        return None

    payload = {
        "model": model or settings.ollama_model,
        "stream": False,
        "options": {"temperature": temperature, "num_predict": num_predict},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as c:
            r = await c.post(f"{base}/api/chat", json=payload)
        if r.status_code != 200:
            logger.warning("Ollama /api/chat returned %s: %s", r.status_code, r.text[:200])
            return None
        body = r.json()
    except (httpx.HTTPError, OSError, json.JSONDecodeError) as e:
        logger.warning("Ollama complete_text failed: %s", e)
        return None

    msg = body.get("message") or {}
    content = msg.get("content")
    return content.strip() if isinstance(content, str) and content.strip() else None


async def complete_json(
    system: str,
    user: str,
    *,
    model: str | None = None,
    temperature: float = 0.25,
    num_predict: int = 2048,
) -> dict[str, Any] | None:
    """Forces Ollama's JSON-mode output and parses the first object out of it.

    Pass-through of `format=json` makes llama3.1 reliably emit a single object,
    but we still defensively parse so a stray markdown fence doesn't break us.
    """
    base = _base_url()
    if not base:
        return None

    payload = {
        "model": model or settings.ollama_model,
        "stream": False,
        "format": "json",
        "options": {"temperature": temperature, "num_predict": num_predict},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=settings.ollama_timeout_seconds) as c:
            r = await c.post(f"{base}/api/chat", json=payload)
        if r.status_code != 200:
            logger.warning("Ollama /api/chat (json) returned %s: %s", r.status_code, r.text[:200])
            return None
        body = r.json()
    except (httpx.HTTPError, OSError, json.JSONDecodeError) as e:
        logger.warning("Ollama complete_json failed: %s", e)
        return None

    msg = body.get("message") or {}
    raw = msg.get("content")
    if not isinstance(raw, str):
        return None
    # When format=json works, raw IS a JSON object string. Try direct parse first.
    try:
        out = json.loads(raw)
        if isinstance(out, dict):
            return out
    except json.JSONDecodeError:
        pass
    return _extract_first_json_object(raw)
