from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import Learner
from app.db.session import get_db
from app.schemas.ai import InterventionRequest
from app.services.interventions import draft_intervention
from app.services.risk_predictor import at_risk_probability

router = APIRouter()


class AtRiskRow(BaseModel):
    learner_id: str
    name: str
    goal: str
    at_risk_score: float
    quiz_avg: int
    logins_last_14d: int


@router.get("/at-risk", response_model=list[AtRiskRow])
def at_risk_list(db: Session = Depends(get_db)):
    rows = db.query(Learner).all()
    scored: list[AtRiskRow] = []
    for L in rows:
        p = at_risk_probability(L)
        scored.append(
            AtRiskRow(
                learner_id=L.id,
                name=L.name,
                goal=L.goal,
                at_risk_score=round(p, 4),
                quiz_avg=L.quiz_avg,
                logins_last_14d=L.logins_last_14d,
            )
        )
    scored.sort(key=lambda x: x.at_risk_score, reverse=True)
    return scored


@router.post("/intervene")
async def intervene(body: InterventionRequest, db: Session = Depends(get_db)):
    if not db.get(Learner, body.learner_id):
        raise HTTPException(status_code=404, detail="Learner not found")
    message = await draft_intervention(db, body.learner_id)
    return {"message": message}
