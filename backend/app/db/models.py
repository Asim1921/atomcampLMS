import json
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str] = mapped_column(Text, default="")
    audience: Mapped[str] = mapped_column(Text, default="")
    prerequisites_json: Mapped[str] = mapped_column(Text, default="[]")
    embedding_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    # --- new (LMS) ---
    owner_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    level: Mapped[str] = mapped_column(String(32), default="beginner")
    tags_json: Mapped[str] = mapped_column(Text, default="[]")
    cover_emoji: Mapped[str] = mapped_column(String(8), default="📘")
    duration_hours: Mapped[int] = mapped_column(Integer, default=6)
    published: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def prerequisites_list(self) -> list[str]:
        try:
            return json.loads(self.prerequisites_json or "[]")
        except json.JSONDecodeError:
            return []

    def tags(self) -> list[str]:
        try:
            raw = json.loads(self.tags_json or "[]")
            return raw if isinstance(raw, list) else []
        except json.JSONDecodeError:
            return []


class Lesson(Base):
    __tablename__ = "lessons"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    course_id: Mapped[str] = mapped_column(String(64), index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(512))
    summary: Mapped[str] = mapped_column(Text, default="")
    content_md: Mapped[str] = mapped_column(Text, default="")
    video_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    estimated_minutes: Mapped[int] = mapped_column(Integer, default=15)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Enrollment(Base):
    __tablename__ = "enrollments"

    # Composite primary key keeps the rows naturally idempotent.
    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    course_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)


class LessonProgress(Base):
    __tablename__ = "lesson_progress"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Quiz(Base):
    __tablename__ = "quizzes"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    lesson_id: Mapped[str] = mapped_column(String(64), index=True, unique=True)
    title: Mapped[str] = mapped_column(String(512), default="Lesson check")
    passing_score: Mapped[int] = mapped_column(Integer, default=70)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    quiz_id: Mapped[str] = mapped_column(String(64), index=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    prompt: Mapped[str] = mapped_column(Text)
    choices_json: Mapped[str] = mapped_column(Text, default="[]")
    correct_choice_id: Mapped[str] = mapped_column(String(16))

    def choices(self) -> list[dict]:
        try:
            raw = json.loads(self.choices_json or "[]")
            return raw if isinstance(raw, list) else []
        except json.JSONDecodeError:
            return []


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    quiz_id: Mapped[str] = mapped_column(String(64), index=True)
    score: Mapped[int] = mapped_column(Integer, default=0)
    total: Mapped[int] = mapped_column(Integer, default=0)
    correct: Mapped[int] = mapped_column(Integer, default=0)
    answers_json: Mapped[str] = mapped_column(Text, default="{}")
    submitted_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Learner(Base):
    __tablename__ = "learners"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256))
    goal: Mapped[str] = mapped_column(Text, default="")
    current_skill_level: Mapped[str] = mapped_column(String(64), default="beginner")
    pace: Mapped[str] = mapped_column(String(64), default="steady")
    preferred_modality: Mapped[str] = mapped_column(String(128), default="mixed")
    struggle_topics_json: Mapped[str] = mapped_column(Text, default="[]")
    confidence_score: Mapped[float] = mapped_column(Float, default=0.5)
    logins_last_14d: Mapped[int] = mapped_column(Integer, default=0)
    avg_session_min: Mapped[int] = mapped_column(Integer, default=20)
    quiz_avg: Mapped[int] = mapped_column(Integer, default=60)
    dna_embedding_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    onboarding_completed: Mapped[int] = mapped_column(Integer, default=0)

    def struggle_topics(self) -> list[str]:
        try:
            raw: Any = json.loads(self.struggle_topics_json or "[]")
            return raw if isinstance(raw, list) else []

        except json.JSONDecodeError:
            return []


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(256))
    password_hash: Mapped[str | None] = mapped_column(String(512), nullable=True)
    role: Mapped[str] = mapped_column(String(32), default="learner")
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    bio: Mapped[str] = mapped_column(Text, default="")
    interests_json: Mapped[str] = mapped_column(Text, default="[]")
    learner_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    auth_provider: Mapped[str] = mapped_column(String(32), default="password")
    google_sub: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    onboarding_completed: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def interests(self) -> list[str]:
        try:
            raw: Any = json.loads(self.interests_json or "[]")
            return [str(x) for x in raw] if isinstance(raw, list) else []
        except json.JSONDecodeError:
            return []


class Favorite(Base):
    __tablename__ = "favorites"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    course_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    token_hash: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
