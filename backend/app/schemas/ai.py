from pydantic import BaseModel, Field


class DiagnosticStartRequest(BaseModel):
    goal: str = Field(..., min_length=3, max_length=2000)


class DiagnosticCompleteRequest(BaseModel):
    learner_id: str | None = None
    name: str = Field(default="Learner", max_length=256)
    goal: str = Field(..., min_length=3, max_length=2000)
    answers: dict[str, str] = Field(default_factory=dict)


class TutorChatRequest(BaseModel):
    learner_id: str
    message: str = Field(..., min_length=1, max_length=8000)


class InterventionRequest(BaseModel):
    learner_id: str
