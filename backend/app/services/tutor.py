"""Streaming tutor responses grounded in Learner DNA."""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Learner
from app.prompts import TUTOR_SYSTEM_PREFIX
from app.services import gemini_client as gem

logger = logging.getLogger(__name__)


def _dna_block(learner: Learner) -> str:
    return json.dumps(
        {
            "name": learner.name,
            "goal": learner.goal,
            "current_skill_level": learner.current_skill_level,
            "pace": learner.pace,
            "preferred_modality": learner.preferred_modality,
            "struggle_topics": learner.struggle_topics(),
            "confidence_score": learner.confidence_score,
        },
        ensure_ascii=False,
    )


def _dna_suggestion(learner: Learner) -> str:
    return (
        f"Given your goal—{learner.goal[:120]}—start with one concrete next step "
        f"at {learner.current_skill_level} level, focusing on {', '.join(learner.struggle_topics()[:2]) or 'foundations'}."
    )


def _offline_hint(learner: Learner) -> str:
    return "(Demo mode: set GEMINI_API_KEY for live tutoring.) " + _dna_suggestion(learner)


async def stream_tutor_reply(db: Session, learner_id: str, user_message: str) -> AsyncIterator[str]:
    learner = db.get(Learner, learner_id)
    if not learner:
        yield "Learner not found. Pick a profile from the dashboard."
        return

    system = TUTOR_SYSTEM_PREFIX + _dna_block(learner)
    model = settings.gemini_tutor_model or settings.gemini_model

    if not gem.is_available():
        yield _offline_hint(learner)
        return

    sent = False
    try:
        async for chunk in gem.stream_text(system, user_message, model=model, temperature=0.4):
            if chunk:
                sent = True
                yield chunk
    except Exception as e:
        logger.warning("Tutor stream failed: %s", e)

    if not sent:
        try:
            full = await gem.complete_text(
                system,
                user_message,
                model=model,
                temperature=0.4,
                max_output_tokens=2048,
            )
            if full:
                yield full
                return
        except Exception as e:
            logger.warning("Tutor complete_text fallback failed: %s", e)
        yield "(Tutor temporarily unavailable.) " + _dna_suggestion(learner)
