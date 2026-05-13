"""Instructor intervention drafts via LLM."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.db.models import Learner
from app.prompts import INTERVENTION_SYSTEM
from app.services import gemini_client as gem
from app.services.risk_predictor import at_risk_probability

logger = logging.getLogger(__name__)


async def draft_intervention(db: Session, learner_id: str) -> str:
    learner = db.get(Learner, learner_id)
    if not learner:
        return "Learner not found."

    risk = at_risk_probability(learner)
    facts = (
        f"Learner: {learner.name}\n"
        f"Goal: {learner.goal}\n"
        f"Level: {learner.current_skill_level}\n"
        f"Struggles: {', '.join(learner.struggle_topics())}\n"
        f"Model-estimated at-risk probability: {risk:.2f}\n"
        f"Engagement: logins_14d={learner.logins_last_14d}, avg_session_min={learner.avg_session_min}, quiz_avg={learner.quiz_avg}\n"
    )

    if not gem.is_available():
        return (
            f"Hi {learner.name},\n\n"
            f"I noticed you are working toward: {learner.goal}\n"
            f"Our system flagged some engagement risk (score {risk:.0%}). "
            "I would love to help you get unstuck—reply with a good time this week for a 15-minute check-in.\n\n"
            "— atomcamp instructor"
        )

    try:
        text = await gem.complete_text(
            INTERVENTION_SYSTEM,
            facts,
            temperature=0.45,
            max_output_tokens=1024,
        )
        if text and text.strip():
            return text.strip()
    except Exception as e:
        logger.warning("Intervention LLM failed: %s", e)

    return (
        f"Hi {learner.name}, quick check-in on your goal ({learner.goal[:80]}...). "
        f"If anything is blocking progress, tell me one topic to prioritize this week."
    )
