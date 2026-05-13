"""LLM-generated onboarding diagnostic + classification.

Provider precedence for quiz generation and scoring:
  1. Local Ollama (e.g. llama3.1:8b)  — preferred per user setup.
  2. Google Gemini                    — used if Ollama is offline or returns garbage.
  3. Deterministic static fallback    — last resort so the UI never hangs.
"""

from __future__ import annotations

import json
import logging
import re
import uuid

from sqlalchemy.orm import Session

from app.db.models import Learner
from app.prompts import ONBOARDING_QUIZ_SYSTEM, ONBOARDING_SCORE_SYSTEM
from app.services import gemini_client as gem
from app.services import ollama_client as olm
from app.services.embeddings import ensure_learner_dna_embedding

logger = logging.getLogger(__name__)

_CHOICE_IDS = ("a", "b", "c", "d")


def _extract_json_object(text: str) -> dict | None:
    text = (text or "").strip()
    if not text:
        return None
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        out = json.loads(m.group(0))
        return out if isinstance(out, dict) else None
    except json.JSONDecodeError:
        return None


def _normalize_diagnostic_quiz(data: dict | None) -> dict | None:
    """Ensure exactly 5 questions with ids q1–q5 and four choices a–d."""
    if not data or not isinstance(data.get("questions"), list):
        return None
    out_questions: list[dict] = []
    for raw in data["questions"]:
        if len(out_questions) >= 5:
            break
        if not isinstance(raw, dict):
            continue
        prompt = str(raw.get("prompt", "")).strip()
        if len(prompt) < 8:
            continue
        choices_in = raw.get("choices")
        if not isinstance(choices_in, list):
            continue
        choices: list[dict] = []
        for j, cid in enumerate(_CHOICE_IDS):
            cell = choices_in[j] if j < len(choices_in) else None
            text = ""
            if isinstance(cell, dict):
                text = str(cell.get("text", "")).strip()
            elif isinstance(cell, str):
                text = cell.strip()
            if not text:
                break
            choices.append({"id": cid, "text": text[:800]})
        if len(choices) != 4:
            continue
        out_questions.append(
            {
                "id": f"q{len(out_questions) + 1}",
                "prompt": prompt[:1200],
                "choices": choices,
            }
        )
    if len(out_questions) != 5:
        return None
    return {"questions": out_questions}


async def generate_diagnostic_quiz(goal: str) -> dict:
    goal_clean = (goal or "").strip()[:2000]
    if not goal_clean:
        return _fallback_quiz("")

    user_msg = (
        "The learner stated this INTEREST / GOAL — every one of the 5 questions must probe this exact domain "
        "(use vocabulary and examples from that field, not generic programming):\n\n"
        f'"""{goal_clean}"""\n\n'
        "Return EXACTLY 5 diagnostic questions as a JSON object matching the schema in your system instructions."
    )

    # 1) Local Ollama (llama3.1) — preferred path.
    if await olm.is_available():
        logger.info("[QUIZ] ► Ollama (%s) — interest=%r", "llama3.1", goal_clean[:80])
        data = await olm.complete_json(ONBOARDING_QUIZ_SYSTEM, user_msg, temperature=0.35)
        normalized = _normalize_diagnostic_quiz(data)
        if normalized:
            logger.info("[QUIZ] ✓ Ollama JSON-mode produced %d questions", len(normalized["questions"]))
            return normalized
        # Retry once with plain text; some local prompts need the explicit reminder.
        logger.info("[QUIZ] Ollama JSON-mode output didn't validate; retrying as plain text")
        raw = await olm.complete_text(
            ONBOARDING_QUIZ_SYSTEM,
            user_msg + "\n\nOutput a single JSON object only. No markdown fences, no commentary.",
            temperature=0.2,
            num_predict=3072,
        )
        normalized = _normalize_diagnostic_quiz(_extract_json_object(raw or ""))
        if normalized:
            logger.info("[QUIZ] ✓ Ollama plain-text retry produced %d questions", len(normalized["questions"]))
            return normalized
        logger.warning("[QUIZ] ✗ Ollama output invalid both ways — falling through to Gemini")
    else:
        logger.warning("[QUIZ] Ollama not reachable at %s — falling through to Gemini", olm._base_url())

    # 2) Gemini as a graceful backup.
    if gem.is_available():
        logger.info("[QUIZ] ► Gemini — interest=%r", goal_clean[:80])
        data = await gem.complete_json(ONBOARDING_QUIZ_SYSTEM, user_msg, temperature=0.35, max_output_tokens=4096)
        normalized = _normalize_diagnostic_quiz(data)
        if not normalized:
            raw = await gem.complete_text(
                ONBOARDING_QUIZ_SYSTEM,
                user_msg + "\n\nOutput a single JSON object only. No markdown fences.",
                temperature=0.25,
                max_output_tokens=4096,
            )
            normalized = _normalize_diagnostic_quiz(_extract_json_object(raw or ""))
        if normalized:
            logger.info("[QUIZ] ✓ Gemini produced %d questions", len(normalized["questions"]))
            return normalized
        logger.warning("[QUIZ] ✗ Gemini output invalid — using static fallback")
    else:
        logger.warning("[QUIZ] No Gemini key — using static fallback")

    # 3) Deterministic backup so the UI never hangs.
    logger.warning("[QUIZ] ► STATIC FALLBACK for interest=%r", goal_clean[:80])
    return _fallback_quiz(goal_clean)


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
    summary = "Building your AtomCamp LMS learning profile from your interest and diagnostic responses."

    data: dict | None = None
    if await olm.is_available():
        data = await olm.complete_json(ONBOARDING_SCORE_SYSTEM, payload, temperature=0.2)
    if not data and gem.is_available():
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
    """Static last-resort quiz. Used only when both Ollama and Gemini fail.

    The first question is phrased generically around the stated INTEREST so the
    fallback still feels customized.
    """
    interest = (goal or "this field").strip() or "this field"
    short = interest[:80]
    return {
        "questions": [
            {
                "id": "q1",
                "prompt": (
                    f"How would you describe your current familiarity with {short}?"
                ),
                "choices": [
                    {"id": "a", "text": "Brand new — just exploring the topic"},
                    {"id": "b", "text": "Beginner — read a few articles or tutorials"},
                    {"id": "c", "text": "Intermediate — built or used something in this area"},
                    {"id": "d", "text": "Advanced — I work or have worked in this field"},
                ],
            },
            {
                "id": "q2",
                "prompt": (
                    f"When you encounter a new concept in {short}, what's your preferred next step?"
                ),
                "choices": [
                    {"id": "a", "text": "Watch a short explainer video first"},
                    {"id": "b", "text": "Read official documentation or a textbook chapter"},
                    {"id": "c", "text": "Try a hands-on example and learn by doing"},
                    {"id": "d", "text": "Discuss it with a peer or mentor"},
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
                "prompt": (
                    f"Which type of milestone would best signal real progress for you in {short}?"
                ),
                "choices": [
                    {"id": "a", "text": "Completing a guided course or curriculum"},
                    {"id": "b", "text": "Shipping a small portfolio project"},
                    {"id": "c", "text": "Earning a certificate or assessment"},
                    {"id": "d", "text": "Applying it on the job or in a paid role"},
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
