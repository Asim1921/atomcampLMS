"""Async OpenAI client factory with graceful degradation when no API key."""

from openai import AsyncOpenAI

from app.core.config import settings


def get_async_client() -> AsyncOpenAI | None:
    if not settings.openai_api_key:
        return None
    return AsyncOpenAI(api_key=settings.openai_api_key)
