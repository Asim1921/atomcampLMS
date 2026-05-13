from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.models import Course, Learner, User
from app.db.session import get_db
from app.schemas.courses import CourseOut
from app.schemas.learners import LearnerDNAOut, LearnerSummary
from app.services.embeddings import recommend_course_ids
from app.services.risk_predictor import at_risk_probability

router = APIRouter()


def _summary(L: Learner) -> LearnerSummary:
    return LearnerSummary(
        id=L.id,
        name=L.name,
        goal=L.goal,
        current_skill_level=L.current_skill_level,
        pace=L.pace,
        preferred_modality=L.preferred_modality,
        struggle_topics=L.struggle_topics(),
        confidence_score=L.confidence_score,
        logins_last_14d=L.logins_last_14d,
        avg_session_min=L.avg_session_min,
        quiz_avg=L.quiz_avg,
        onboarding_completed=bool(L.onboarding_completed),
        at_risk_score=at_risk_probability(L),
        has_dna_embedding=bool(L.dna_embedding_json),
    )


def _dna(L: Learner) -> LearnerDNAOut:
    return LearnerDNAOut(
        id=L.id,
        name=L.name,
        goal=L.goal,
        current_skill_level=L.current_skill_level,
        pace=L.pace,
        preferred_modality=L.preferred_modality,
        struggle_topics=L.struggle_topics(),
        confidence_score=L.confidence_score,
        quiz_avg=L.quiz_avg,
        onboarding_completed=bool(L.onboarding_completed),
        engagement={
            "logins_last_14d": L.logins_last_14d,
            "avg_session_min": L.avg_session_min,
            "quiz_avg": L.quiz_avg,
        },
        at_risk_score=at_risk_probability(L),
        has_dna_embedding=bool(L.dna_embedding_json),
    )


def _can_view_any_learner(user: User) -> bool:
    return user.role in ("admin", "instructor")


@router.get("/learners", response_model=list[LearnerSummary])
def list_learners(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if _can_view_any_learner(user):
        rows = db.query(Learner).order_by(Learner.name).all()
        return [_summary(L) for L in rows]
    if user.learner_id:
        L = db.get(Learner, user.learner_id)
        return [_summary(L)] if L else []
    return []


@router.get("/learners/{learner_id}", response_model=LearnerDNAOut)
def get_learner(learner_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    L = db.get(Learner, learner_id)
    if not L:
        raise HTTPException(status_code=404, detail="Learner not found")
    if not _can_view_any_learner(user) and user.learner_id != learner_id:
        raise HTTPException(status_code=403, detail="Not allowed to view this learner profile")
    return _dna(L)


@router.get("/recommendations/{learner_id}", response_model=list[CourseOut])
def recommendations(learner_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    learner = db.get(Learner, learner_id)
    if not learner:
        raise HTTPException(status_code=404, detail="Learner not found")
    if not _can_view_any_learner(user) and user.learner_id != learner_id:
        raise HTTPException(status_code=403, detail="Not allowed to view recommendations for this learner")
    ranked = recommend_course_ids(db, learner, top_k=5)
    out: list[CourseOut] = []
    for cid, score in ranked:
        c = db.get(Course, cid)
        if c:
            out.append(
                CourseOut(
                    id=c.id,
                    title=c.title,
                    description=c.description,
                    audience=c.audience,
                    prerequisites=c.prerequisites_list(),
                    match_score=round(score, 4),
                )
            )
    return out
