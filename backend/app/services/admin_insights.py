"""Cohort aggregates + LLM weekly-style insight."""

from __future__ import annotations

import logging
from statistics import mean

from sqlalchemy.orm import Session

from app.db.models import Learner
from app.prompts import ADMIN_WEEKLY_INSIGHT_SYSTEM
from app.services import gemini_client as gem
from app.services.risk_predictor import at_risk_probability

logger = logging.getLogger(__name__)


async def build_admin_payload(db: Session) -> dict:
    learners = db.query(Learner).all()
    n = len(learners)
    if n == 0:
        return {"learner_count": 0, "avg_quiz": 0, "avg_logins": 0, "at_risk_count": 0}

    risks = [at_risk_probability(L) for L in learners]
    at_risk = sum(1 for r in risks if r >= 0.45)

    payload = {
        "learner_count": n,
        "avg_quiz": round(mean(L.quiz_avg for L in learners), 1),
        "avg_logins": round(mean(L.logins_last_14d for L in learners), 1),
        "at_risk_count": at_risk,
        "avg_confidence": round(mean(L.confidence_score for L in learners), 2),
        "beginner_share": round(
            100.0 * sum(1 for L in learners if L.current_skill_level == "beginner") / n,
            1,
        ),
    }

    stats_text = (
        f"Cohort size: {n}\n"
        f"Average quiz score: {payload['avg_quiz']}\n"
        f"Average logins (14d): {payload['avg_logins']}\n"
        f"Estimated at-risk learners: {at_risk}\n"
        f"Average confidence score: {payload['avg_confidence']}\n"
        f"Percent beginner-level: {payload['beginner_share']}%\n"
    )

    insight = ""
    if gem.is_available():
        try:
            insight = (
                await gem.complete_text(
                    ADMIN_WEEKLY_INSIGHT_SYSTEM,
                    stats_text,
                    temperature=0.35,
                    max_output_tokens=1024,
                )
                or ""
            ).strip()
        except Exception as e:
            logger.warning("Admin insight LLM failed: %s", e)

    if not insight:
        insight = (
            "SUMMARY\n"
            f"Cohort of {n} learners; average quiz {payload['avg_quiz']} with {payload['avg_logins']} logins/14d.\n\n"
            "BULLETS\n"
            f"- {at_risk} learners may need proactive outreach.\n"
            "- Content gaps often cluster around first applied project week.\n"
            "- Confidence scores suggest mixed readiness for advanced AI modules.\n\n"
            "ACTION\n"
            "Schedule a targeted review session for flagged learners and share a one-page study plan template."
        )

    payload["weekly_insight"] = insight
    return payload
