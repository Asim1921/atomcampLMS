"""Seed SQLite from JSON and synthesize extra learners for richer demos."""

from __future__ import annotations

import json
import random
import uuid
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import Course, Learner, Lesson, User
from app.services.security import hash_password

_GOALS = [
    "Master Generative AI and LLM apps for production",
    "Become a data analyst and land freelance clients",
    "Build agentic AI workflows for my team",
    "Transition from Excel to Python for analytics",
    "Prepare for AI engineering interviews",
    "Automate daily work with AI tools",
]
_NAMES = [
    "Fatima Noor",
    "Omar Siddiqui",
    "Zainab Malik",
    "Usman Tariq",
    "Hira Shah",
    "Ali Rauf",
    "Maryam Javed",
    "Danish Iqbal",
]

SEED_INSTRUCTOR_EMAIL = "staff@atomcamp.com"
SEED_INSTRUCTOR_PASSWORD = "atomcamp-demo-2026"

# A few cover emojis for variety on seeded courses.
_COVER_BY_TAG = {
    "ai": "🧠",
    "ml": "📈",
    "data": "📊",
    "frontend": "🎨",
    "backend": "⚙️",
    "web": "🌐",
    "mobile": "📱",
    "cloud": "☁️",
    "design": "🖌️",
    "sql": "🗃️",
    "agent": "🤖",
}


def _emoji_for(course_id: str, title: str) -> str:
    blob = f"{course_id} {title}".lower()
    for k, v in _COVER_BY_TAG.items():
        if k in blob:
            return v
    return "📘"


def _load_json(path: str) -> list[dict]:
    p = Path(path)
    if not p.exists():
        return []
    return json.loads(p.read_text(encoding="utf-8"))


def _ensure_seed_instructor(db: Session) -> User:
    u = db.query(User).filter(User.email == SEED_INSTRUCTOR_EMAIL).first()
    if u:
        return u
    u = User(
        id=uuid.uuid4().hex,
        email=SEED_INSTRUCTOR_EMAIL,
        name="atomcamp Staff",
        password_hash=hash_password(SEED_INSTRUCTOR_PASSWORD),
        role="instructor",
        auth_provider="password",
        onboarding_completed=1,
        created_at=datetime.utcnow(),
    )
    db.add(u)
    db.flush()
    return u


def _starter_lessons(course_title: str) -> list[dict]:
    """Build a 3-lesson starter pack so seeded courses have real navigable content."""

    short = course_title.split("(")[0].strip()
    return [
        {
            "title": f"Welcome to {short}",
            "summary": "What you'll learn, prerequisites, and how to get the most from this track.",
            "content_md": (
                f"# Welcome to {short}\n\n"
                f"This bootcamp is built around the personalization model atomcamp uses across its programs.\n\n"
                "## What you'll learn\n"
                "- Core fundamentals delivered week by week\n"
                "- Hands-on labs that build a portfolio piece\n"
                "- A capstone you can ship\n\n"
                "## How this course works\n"
                "Lessons stack progressively. Each ends with a short check-in quiz that updates your Learner DNA — "
                "so the AI tutor and recommendation engine stay tuned to where you are."
            ),
            "estimated_minutes": 8,
        },
        {
            "title": "Core concepts & vocabulary",
            "summary": "Build a shared mental model before going deep.",
            "content_md": (
                "# Core concepts\n\n"
                "We start with the vocabulary you'll use for the rest of the course. "
                "Don't memorize — recognize. Each idea here will be revisited with real examples.\n\n"
                "## Why this matters\n"
                "Most learners stall at week 2 because the early vocabulary was glossed over. "
                "Slow down here and the rest moves fast.\n\n"
                "## Try it\n"
                "Open the tutor drawer on the right and ask: 'Explain the core concept I just read in plain language.'"
            ),
            "estimated_minutes": 18,
        },
        {
            "title": "Your first hands-on lab",
            "summary": "Apply the concepts to a small, realistic problem.",
            "content_md": (
                "# Hands-on lab\n\n"
                "Theory without practice fades fast. This lab takes 20–30 minutes and reinforces "
                "what you've read.\n\n"
                "## Steps\n"
                "1. Set up your environment\n"
                "2. Reproduce the example\n"
                "3. Modify one variable and observe the change\n"
                "4. Note any surprise — that's your signal to ask the tutor\n\n"
                "Mark this lesson complete when you've finished step 4."
            ),
            "estimated_minutes": 28,
        },
    ]


def _seed_lessons_for_course(db: Session, course: Course) -> None:
    # Skip if this course already has lessons (idempotent on re-boot).
    if db.query(Lesson).filter(Lesson.course_id == course.id).first():
        return
    for i, l in enumerate(_starter_lessons(course.title)):
        db.add(
            Lesson(
                id=uuid.uuid4().hex,
                course_id=course.id,
                order_index=i,
                title=l["title"],
                summary=l["summary"],
                content_md=l["content_md"],
                estimated_minutes=l["estimated_minutes"],
            )
        )


def seed_from_files(db: Session) -> None:
    instructor = _ensure_seed_instructor(db)

    courses_json = _load_json(settings.courses_json_path)

    # First-time path: no courses yet.
    if not db.query(Course).first():
        for c in courses_json:
            cid = c["id"]
            title = c["title"]
            db.add(
                Course(
                    id=cid,
                    title=title,
                    description=c.get("description", ""),
                    audience=c.get("audience", ""),
                    prerequisites_json=json.dumps(c.get("prerequisites", [])),
                    owner_user_id=instructor.id,
                    level="beginner" if "fundamental" in title.lower() or "beginners" in c.get("audience", "").lower() else "intermediate",
                    tags_json=json.dumps([t.strip() for t in cid.replace("ac-", "").split("-") if t]),
                    cover_emoji=_emoji_for(cid, title),
                    duration_hours=12,
                    published=1,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
            )

        learners = _load_json(settings.learners_json_path)
        for row in learners:
            e = row.get("engagement", {})
            db.add(
                Learner(
                    id=row["id"],
                    name=row["name"],
                    goal=row.get("goal", ""),
                    current_skill_level=row.get("current_skill_level", "beginner"),
                    pace=row.get("pace", "steady"),
                    preferred_modality=row.get("preferred_modality", "mixed"),
                    struggle_topics_json=json.dumps(row.get("struggle_topics", [])),
                    confidence_score=float(row.get("confidence_score", 0.5)),
                    logins_last_14d=int(e.get("logins_last_14d", 0)),
                    avg_session_min=int(e.get("avg_session_min", 20)),
                    quiz_avg=int(e.get("quiz_avg", 60)),
                    onboarding_completed=1,
                )
            )

        rng = random.Random(42)
        for i in range(45):
            lid = f"learner_synth_{i:03d}"
            goal = rng.choice(_GOALS)
            logins = rng.randint(2, 12)
            quiz = rng.randint(45, 85)
            db.add(
                Learner(
                    id=lid,
                    name=rng.choice(_NAMES) + f" #{i}",
                    goal=goal,
                    current_skill_level=rng.choice(["beginner", "intermediate"]),
                    pace=rng.choice(["slow", "steady", "fast"]),
                    preferred_modality=rng.choice(["video + projects", "reading + practice", "live labs"]),
                    struggle_topics_json=json.dumps(
                        rng.sample(
                            ["SQL", "Python", "statistics", "LLM eval", "deployment", "pandas"],
                            k=rng.randint(1, 3),
                        )
                    ),
                    confidence_score=round(rng.uniform(0.35, 0.85), 2),
                    logins_last_14d=logins,
                    avg_session_min=rng.randint(12, 50),
                    quiz_avg=quiz,
                    onboarding_completed=1,
                )
            )

        db.commit()

    # Backfill: courses created before the LMS migration may be missing owner / metadata.
    for course in db.query(Course).all():
        changed = False
        if not course.owner_user_id:
            course.owner_user_id = instructor.id
            changed = True
        if not course.cover_emoji:
            course.cover_emoji = _emoji_for(course.id, course.title)
            changed = True
        if not course.tags_json or course.tags_json == "[]":
            course.tags_json = json.dumps(
                [t.strip() for t in course.id.replace("ac-", "").split("-") if t]
            )
            changed = True
        if not course.created_at:
            course.created_at = datetime.utcnow()
            changed = True
        if not course.updated_at:
            course.updated_at = datetime.utcnow()
            changed = True
        if changed:
            db.add(course)

    # Idempotent lesson seeding for any course that doesn't yet have lessons.
    for course in db.query(Course).all():
        _seed_lessons_for_course(db, course)

    db.commit()
