import json

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.ai import DiagnosticCompleteRequest, DiagnosticStartRequest
from app.schemas.learners import LearnerDNAOut
from app.services.onboarding import (
    generate_diagnostic_quiz,
    generate_diagnostic_quiz_stream,
    score_onboarding,
)
from app.services.risk_predictor import at_risk_probability

router = APIRouter()


def _dna_out(learner) -> LearnerDNAOut:
    return LearnerDNAOut(
        id=learner.id,
        name=learner.name,
        goal=learner.goal,
        current_skill_level=learner.current_skill_level,
        pace=learner.pace,
        preferred_modality=learner.preferred_modality,
        struggle_topics=learner.struggle_topics(),
        confidence_score=learner.confidence_score,
        quiz_avg=learner.quiz_avg,
        onboarding_completed=bool(learner.onboarding_completed),
        engagement={
            "logins_last_14d": learner.logins_last_14d,
            "avg_session_min": learner.avg_session_min,
            "quiz_avg": learner.quiz_avg,
        },
        at_risk_score=at_risk_probability(learner),
        has_dna_embedding=bool(learner.dna_embedding_json),
    )


@router.post("/diagnostic")
async def diagnostic_start(body: DiagnosticStartRequest):
    return await generate_diagnostic_quiz(body.goal)


@router.post("/diagnostic/stream")
async def diagnostic_start_stream(body: DiagnosticStartRequest):
    """SSE stream of quiz generation progress.

    Emits events of the form `data: {...}\\n\\n` where each payload matches the
    service-layer event shape (stage=started|progress|thinking|done|error).
    """

    async def event_iter():
        try:
            async for ev in generate_diagnostic_quiz_stream(body.goal):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except Exception as e:  # pragma: no cover — defensive: never break the stream silently.
            yield f"data: {json.dumps({'stage': 'error', 'detail': str(e)})}\n\n"

    return StreamingResponse(
        event_iter(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # disable proxy buffering so events flush promptly
        },
    )


@router.post("/diagnostic/complete")
async def diagnostic_complete(body: DiagnosticCompleteRequest, db: Session = Depends(get_db)):
    learner = await score_onboarding(
        db,
        learner_id=body.learner_id,
        name=body.name,
        goal=body.goal,
        answers=body.answers,
    )
    return _dna_out(learner)
