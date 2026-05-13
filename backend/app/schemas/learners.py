from pydantic import BaseModel, ConfigDict


class LearnerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    goal: str
    current_skill_level: str
    pace: str
    preferred_modality: str
    struggle_topics: list[str]
    confidence_score: float
    logins_last_14d: int
    avg_session_min: int
    quiz_avg: int
    onboarding_completed: bool
    at_risk_score: float
    has_dna_embedding: bool


class LearnerDNAOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    goal: str
    current_skill_level: str
    pace: str
    preferred_modality: str
    struggle_topics: list[str]
    confidence_score: float
    quiz_avg: int
    onboarding_completed: bool
    engagement: dict
    at_risk_score: float
    has_dna_embedding: bool
