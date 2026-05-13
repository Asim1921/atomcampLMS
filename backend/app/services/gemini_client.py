"""Google Gemini client helpers used by every AI surface in the app.

The official `google-generativeai` SDK is sync; we wrap each call in
`asyncio.to_thread` so FastAPI handlers stay non-blocking.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import AsyncIterator
from typing import Any

import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)

_configured = False


def _ensure_configured() -> bool:
    global _configured
    if _configured:
        return True
    if not settings.gemini_api_key:
        return False
    genai.configure(api_key=settings.gemini_api_key)
    _configured = True
    return True


def is_available() -> bool:
    return _ensure_configured()


def _extract_json(text: str) -> dict[str, Any] | None:
    text = (text or "").strip()
    if not text:
        return None
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None


def _model(name: str | None, *, system_instruction: str | None = None) -> Any | None:
    if not _ensure_configured():
        return None
    return genai.GenerativeModel(
        model_name=name or settings.gemini_model,
        system_instruction=system_instruction,
    )


async def complete_text(
    system: str,
    user: str,
    *,
    model: str | None = None,
    temperature: float = 0.4,
    max_output_tokens: int = 1024,
) -> str | None:
    """Single-shot non-streaming text completion."""
    m = _model(model, system_instruction=system)
    if not m:
        return None

    def _call() -> str | None:
        try:
            resp = m.generate_content(
                user,
                generation_config={
                    "temperature": temperature,
                    "max_output_tokens": max_output_tokens,
                },
            )
            return (getattr(resp, "text", "") or "").strip() or None
        except Exception as e:
            logger.warning("Gemini complete_text failed: %s", e)
            return None

    return await asyncio.to_thread(_call)


async def complete_json(
    system: str,
    user: str,
    *,
    model: str | None = None,
    temperature: float = 0.3,
    max_output_tokens: int = 2048,
) -> dict[str, Any] | None:
    """JSON-mode output; parse first object."""
    m = _model(model, system_instruction=system)
    if not m:
        return None

    def _call() -> dict[str, Any] | None:
        try:
            resp = m.generate_content(
                user,
                generation_config={
                    "temperature": temperature,
                    "max_output_tokens": max_output_tokens,
                    "response_mime_type": "application/json",
                },
            )
            raw = (getattr(resp, "text", "") or "").strip()
            return _extract_json(raw) if raw else None
        except Exception as e:
            logger.warning("Gemini complete_json failed: %s", e)
            return None

    return await asyncio.to_thread(_call)


async def stream_text(
    system: str,
    user: str,
    *,
    model: str | None = None,
    temperature: float = 0.4,
) -> AsyncIterator[str]:
    """Pseudo-streaming: Gemini sync SDK yields chunks in a worker; we forward to the client."""
    m = _model(model or settings.gemini_tutor_model or settings.gemini_model, system_instruction=system)
    if not m:
        return

    def collect_chunks() -> list[str]:
        parts: list[str] = []
        try:
            stream = m.generate_content(
                user,
                stream=True,
                generation_config={"temperature": temperature},
            )
            for chunk in stream:
                t = getattr(chunk, "text", "") or ""
                if t:
                    parts.append(t)
        except Exception as e:
            logger.warning("Gemini stream_text failed: %s", e)
        return parts

    chunks = await asyncio.to_thread(collect_chunks)
    for piece in chunks:
        yield piece


async def embed_text(text: str, *, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float] | None:
    """Gemini embedding API (task_type: RETRIEVAL_DOCUMENT for corpus, RETRIEVAL_QUERY for learner text)."""
    if not _ensure_configured():
        return None

    def _call() -> list[float] | None:
        try:
            resp = genai.embed_content(
                model=f"models/{settings.gemini_embedding_model}",
                content=text[:8000],
                task_type=task_type,
            )
            if isinstance(resp, dict):
                vec = resp.get("embedding")
            else:
                vec = getattr(resp, "embedding", None)
            return list(vec) if vec else None
        except Exception as e:
            logger.warning("Gemini embed_text failed: %s", e)
            return None

    return await asyncio.to_thread(_call)
