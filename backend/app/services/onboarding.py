"""LLM-generated onboarding diagnostic + classification."""

from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy.orm import Session

from app.db.models import Learner
from app.prompts import ONBOARDING_QUIZ_SYSTEM, ONBOARDING_SCORE_SYSTEM
from app.services import gemini_client as gem
from app.services.embeddings import ensure_learner_dna_embedding

logger = logging.getLogger(__name__)


async def generate_diagnostic_quiz(goal: str) -> dict:
    if not gem.is_available():
        return _fallback_quiz(goal)

    user = f'Learner goal: """{goal}"""'
    data = await gem.complete_json(ONBOARDING_QUIZ_SYSTEM, user, temperature=0.35)
    if data and isinstance(data.get("questions"), list) and len(data["questions"]) >= 1:
        return data
    return _fallback_quiz(goal)


async def score_onboarding(
    db: Session,
    *,
    learner_id: str | None,
    name: str,
    goal: str,
    answers: dict[str, str],
) -> Learner:
    payload = json.dumps({"goal": goal, "answers": answers}, ensure_ascii=False)

    skill = "beginner"
    struggles: list[str] = ["foundations", "practice pacing"]
    confidence = 0.55
    summary = "Building your atomcamp learning profile from your goal and diagnostic responses."

    if gem.is_available():
        data = await gem.complete_json(ONBOARDING_SCORE_SYSTEM, payload, temperature=0.2)
        if data:
            skill = str(data.get("current_skill_level", skill))
            st = data.get("inferred_struggle_topics", struggles)
            struggles = st if isinstance(st, list) else struggles
            try:
                confidence = float(data.get("confidence_score", confidence))
            except (TypeError, ValueError):
                confidence = 0.55
            summary = str(data.get("one_sentence_summary", summary))

    if learner_id:
        learner = db.get(Learner, learner_id)
        if not learner:
            learner = None
    else:
        learner = None

    if learner is None:
        learner = Learner(
            id=f"learner_{uuid.uuid4().hex[:12]}",
            name=name or "New learner",
            goal=goal,
            current_skill_level=skill,
            pace="steady",
            preferred_modality="mixed",
            struggle_topics_json=json.dumps(struggles[:8]),
            confidence_score=confidence,
            logins_last_14d=5,
            avg_session_min=25,
            quiz_avg=60,
            onboarding_completed=1,
        )
        db.add(learner)
    else:
        learner.goal = goal
        learner.current_skill_level = skill
        learner.struggle_topics_json = json.dumps(struggles[:8])
        learner.confidence_score = confidence
        learner.onboarding_completed = 1

    db.commit()
    db.refresh(learner)
    await ensure_learner_dna_embedding(db, learner)
    db.refresh(learner)
    return learner


def _fallback_quiz(goal: str) -> dict:
    return {
        "questions": [
            {
                "id": "q1",
                "prompt": f'For the goal "{goal[:80]}...", what best describes your current comfort with Python?',
                "choices": [
                    {"id": "a", "text": "New — I have not used Python yet"},
                    {"id": "b", "text": "Beginner — small scripts and tutorials"},
                    {"id": "c", "text": "Intermediate — comfortable with packages and APIs"},
                    {"id": "d", "text": "Advanced — I ship services or libraries"},
                ],
            },
            {
                "id": "q2",
                "prompt": "How familiar are you with reading API documentation and debugging errors?",
                "choices": [
                    {"id": "a", "text": "Not familiar"},
                    {"id": "b", "text": "Somewhat — I need guidance"},
                    {"id": "c", "text": "Comfortable most of the time"},
                    {"id": "d", "text": "Very comfortable — I mentor others"},
                ],
            },
            {
                "id": "q3",
                "prompt": "Pick the closest match to your preferred learning style.",
                "choices": [
                    {"id": "a", "text": "Short videos + quizzes"},
                    {"id": "b", "text": "Hands-on projects"},
                    {"id": "c", "text": "Live cohort sessions"},
                    {"id": "d", "text": "Reading docs and experimenting solo"},
                ],
            },
            {
                "id": "q4",
                "prompt": "How do you feel about statistics and interpreting metrics?",
                "choices": [
                    {"id": "a", "text": "Avoid it / not confident"},
                    {"id": "b", "text": "Basics only"},
                    {"id": "c", "text": "Comfortable for work tasks"},
                    {"id": "d", "text": "Strong — I design experiments/metrics"},
                ],
            },
            {
                "id": "q5",
                "prompt": "What is your time commitment for the next 4 weeks?",
                "choices": [
                    {"id": "a", "text": "< 3 hours/week"},
                    {"id": "b", "text": "3-6 hours/week"},
                    {"id": "c", "text": "6-10 hours/week"},
                    {"id": "d", "text": "10+ hours/week"},
                ],
            },
        ]
    }
