"""Course CRUD + catalog + lesson management + enrollment + quiz routes.

Authorization model:
  - GET catalog / GET single course: open to anyone signed in.
  - POST a new course: must already be an instructor or admin.
  - PUT/DELETE on a course: must be the course owner (instructor) OR an admin.
  - Learners cannot author. Admins promote users to `instructor` directly in the DB / admin tools.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.models import (
    Course,
    Enrollment,
    Learner,
    Lesson,
    LessonProgress,
    Quiz,
    QuizAttempt,
    QuizQuestion,
    User,
)
from app.db.session import get_db
from app.schemas.courses import (
    CourseCreate,
    CourseDetail,
    CourseSummary,
    CourseUpdate,
    EnrollmentSummary,
    LessonCompleteResponse,
    LessonCreate,
    LessonDetail,
    LessonReorderRequest,
    LessonSummary,
    LessonUpdate,
    QuizAttemptRequest,
    QuizAttemptResult,
    QuizForAuthor,
    QuizForLearner,
    QuizUpsert,
)

router = APIRouter()


# ============================================================
# Helpers
# ============================================================
def _is_instructor(user: User) -> bool:
    return user.role in ("instructor", "admin")


def _can_edit_course(user: User, course: Course) -> bool:
    if user.role == "admin":
        return True
    return user.role == "instructor" and course.owner_user_id == user.id


def _require_owner(user: User, course: Course) -> None:
    if not _can_edit_course(user, course):
        raise HTTPException(status_code=403, detail="You don't own this course.")


def _lesson_ids_for_course(db: Session, course_id: str) -> list[str]:
    return [
        lid
        for (lid,) in db.query(Lesson.id).filter(Lesson.course_id == course_id).order_by(Lesson.order_index).all()
    ]


def _progress_pct(db: Session, user_id: str, course_id: str) -> int:
    lesson_ids = _lesson_ids_for_course(db, course_id)
    if not lesson_ids:
        return 0
    done = (
        db.query(func.count(LessonProgress.lesson_id))
        .filter(LessonProgress.user_id == user_id, LessonProgress.lesson_id.in_(lesson_ids))
        .scalar()
        or 0
    )
    return int(round(100 * done / len(lesson_ids)))


def _course_summary(
    db: Session, course: Course, owner_name_map: dict[str, str], viewer_id: str | None
) -> CourseSummary:
    lesson_count = (
        db.query(func.count(Lesson.id)).filter(Lesson.course_id == course.id).scalar() or 0
    )
    enrolled_count = (
        db.query(func.count(Enrollment.user_id)).filter(Enrollment.course_id == course.id).scalar() or 0
    )

    is_enrolled = False
    progress_pct = 0
    if viewer_id:
        is_enrolled = (
            db.query(Enrollment)
            .filter(Enrollment.user_id == viewer_id, Enrollment.course_id == course.id)
            .first()
            is not None
        )
        if is_enrolled:
            progress_pct = _progress_pct(db, viewer_id, course.id)

    return CourseSummary(
        id=course.id,
        title=course.title,
        description=course.description,
        audience=course.audience,
        level=course.level,
        tags=course.tags(),
        cover_emoji=course.cover_emoji or "📘",
        duration_hours=course.duration_hours or 0,
        published=bool(course.published),
        owner_user_id=course.owner_user_id,
        owner_name=owner_name_map.get(course.owner_user_id or "", None),
        lesson_count=lesson_count,
        enrolled_count=enrolled_count,
        is_enrolled=is_enrolled,
        progress_pct=progress_pct,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


def _lesson_summary(
    db: Session, lesson: Lesson, completed_set: set[str], quiz_lesson_ids: set[str]
) -> LessonSummary:
    return LessonSummary(
        id=lesson.id,
        course_id=lesson.course_id,
        order_index=lesson.order_index,
        title=lesson.title,
        summary=lesson.summary or "",
        estimated_minutes=lesson.estimated_minutes or 0,
        has_quiz=lesson.id in quiz_lesson_ids,
        completed=lesson.id in completed_set,
    )


def _recompute_quiz_avg(db: Session, user: User) -> int | None:
    """Best score per quiz, averaged. Writes back to Learner.quiz_avg."""
    if not user.learner_id:
        return None
    learner = db.get(Learner, user.learner_id)
    if not learner:
        return None
    rows = (
        db.query(QuizAttempt.quiz_id, func.max(QuizAttempt.score))
        .filter(QuizAttempt.user_id == user.id)
        .group_by(QuizAttempt.quiz_id)
        .all()
    )
    if not rows:
        return learner.quiz_avg
    avg = int(round(sum(s for _, s in rows) / len(rows)))
    learner.quiz_avg = avg
    db.add(learner)
    return avg


def _bump_engagement_on_lesson_complete(db: Session, user: User) -> None:
    """Light-touch engagement bump so AI surfaces respond to real activity."""
    if not user.learner_id:
        return
    learner = db.get(Learner, user.learner_id)
    if not learner:
        return
    learner.logins_last_14d = min(14, (learner.logins_last_14d or 0) + 1)
    learner.avg_session_min = max(learner.avg_session_min or 0, 25)
    db.add(learner)


def _owner_name_map(db: Session, course_ids: list[str]) -> dict[str, str]:
    owner_ids = [
        oid
        for (oid,) in db.query(Course.owner_user_id).filter(Course.id.in_(course_ids)).all()
        if oid
    ]
    if not owner_ids:
        return {}
    users = db.query(User).filter(User.id.in_(owner_ids)).all()
    return {u.id: u.name for u in users}


# ============================================================
# Catalog + single course
# ============================================================
@router.get("/courses", response_model=list[CourseSummary])
def list_courses(
    mine: bool = False,
    include_unpublished: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    q = db.query(Course)
    if mine:
        if not _is_instructor(user):
            raise HTTPException(status_code=403, detail="Only instructors can list their own courses.")
        q = q.filter(Course.owner_user_id == user.id)
    elif not include_unpublished:
        q = q.filter(Course.published == 1)

    rows = q.order_by(Course.updated_at.desc()).all()
    name_map = _owner_name_map(db, [c.id for c in rows])
    return [_course_summary(db, c, name_map, user.id) for c in rows]


@router.get("/courses/{course_id}", response_model=CourseDetail)
def get_course(course_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    if not course.published and not _can_edit_course(user, course):
        raise HTTPException(status_code=404, detail="Course not found.")

    name_map = _owner_name_map(db, [course.id])
    summary = _course_summary(db, course, name_map, user.id)

    lessons = (
        db.query(Lesson)
        .filter(Lesson.course_id == course.id)
        .order_by(Lesson.order_index, Lesson.created_at)
        .all()
    )
    completed = {
        lid
        for (lid,) in db.query(LessonProgress.lesson_id)
        .filter(
            LessonProgress.user_id == user.id,
            LessonProgress.lesson_id.in_([l.id for l in lessons]) if lessons else False,
        )
        .all()
    }
    quiz_lesson_ids = {
        lid
        for (lid,) in db.query(Quiz.lesson_id)
        .filter(Quiz.lesson_id.in_([l.id for l in lessons]) if lessons else False)
        .all()
    }

    return CourseDetail(
        **summary.model_dump(),
        prerequisites=course.prerequisites_list(),
        lessons=[_lesson_summary(db, l, completed, quiz_lesson_ids) for l in lessons],
    )


@router.post("/courses", response_model=CourseSummary, status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not _is_instructor(user):
        raise HTTPException(status_code=403, detail="Become an instructor to author courses.")
    now = datetime.utcnow()
    cid = f"crs-{uuid.uuid4().hex[:10]}"
    course = Course(
        id=cid,
        title=body.title.strip(),
        description=body.description,
        audience=body.audience,
        prerequisites_json=json.dumps(body.prerequisites),
        owner_user_id=user.id,
        level=body.level,
        tags_json=json.dumps(body.tags),
        cover_emoji=body.cover_emoji or "📘",
        duration_hours=body.duration_hours,
        published=1 if body.published else 0,
        created_at=now,
        updated_at=now,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return _course_summary(db, course, {user.id: user.name}, user.id)


@router.put("/courses/{course_id}", response_model=CourseSummary)
def update_course(
    course_id: str,
    body: CourseUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)

    patch: dict[str, Any] = body.model_dump(exclude_unset=True)
    if "tags" in patch:
        course.tags_json = json.dumps(patch.pop("tags") or [])
    if "prerequisites" in patch:
        course.prerequisites_json = json.dumps(patch.pop("prerequisites") or [])
    if "published" in patch:
        course.published = 1 if patch.pop("published") else 0
    for k, v in patch.items():
        setattr(course, k, v)
    course.updated_at = datetime.utcnow()
    # Embedding may now be stale; clear it so the next request regenerates.
    course.embedding_json = None
    db.add(course)
    db.commit()
    db.refresh(course)
    return _course_summary(db, course, _owner_name_map(db, [course.id]), user.id)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)

    # cascade child rows by hand (no FK constraints in SQLite without explicit setup)
    lesson_ids = _lesson_ids_for_course(db, course.id)
    if lesson_ids:
        # quizzes & questions tied to these lessons
        quiz_ids = [qid for (qid,) in db.query(Quiz.id).filter(Quiz.lesson_id.in_(lesson_ids)).all()]
        if quiz_ids:
            db.query(QuizQuestion).filter(QuizQuestion.quiz_id.in_(quiz_ids)).delete(synchronize_session=False)
            db.query(QuizAttempt).filter(QuizAttempt.quiz_id.in_(quiz_ids)).delete(synchronize_session=False)
            db.query(Quiz).filter(Quiz.id.in_(quiz_ids)).delete(synchronize_session=False)
        db.query(LessonProgress).filter(LessonProgress.lesson_id.in_(lesson_ids)).delete(synchronize_session=False)
        db.query(Lesson).filter(Lesson.course_id == course.id).delete(synchronize_session=False)
    db.query(Enrollment).filter(Enrollment.course_id == course.id).delete(synchronize_session=False)
    db.delete(course)
    db.commit()
    return None


# ============================================================
# Lessons
# ============================================================
@router.get("/courses/{course_id}/lessons/{lesson_id}", response_model=LessonDetail)
def get_lesson(
    course_id: str,
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    lesson = db.get(Lesson, lesson_id)
    if not lesson or lesson.course_id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found in this course.")

    if not course.published and not _can_edit_course(user, course):
        raise HTTPException(status_code=404, detail="Lesson not found in this course.")

    completed = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson.id)
        .first()
        is not None
    )
    has_quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson.id).first() is not None

    return LessonDetail(
        id=lesson.id,
        course_id=lesson.course_id,
        order_index=lesson.order_index,
        title=lesson.title,
        summary=lesson.summary or "",
        estimated_minutes=lesson.estimated_minutes or 0,
        has_quiz=has_quiz,
        completed=completed,
        content_md=lesson.content_md or "",
        video_url=lesson.video_url,
    )


@router.put("/courses/{course_id}/lessons/order")
def reorder_lessons(
    course_id: str,
    body: LessonReorderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)
    by_id = {l.id: l for l in db.query(Lesson).filter(Lesson.course_id == course_id).all()}
    for item in body.items:
        if item.id in by_id:
            by_id[item.id].order_index = item.order_index
            db.add(by_id[item.id])
    course.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True}


@router.post("/courses/{course_id}/lessons", response_model=LessonSummary, status_code=201)
def create_lesson(
    course_id: str,
    body: LessonCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)

    next_order = (
        db.query(func.coalesce(func.max(Lesson.order_index), -1)).filter(Lesson.course_id == course_id).scalar()
    ) + 1
    lesson = Lesson(
        id=f"lsn-{uuid.uuid4().hex[:10]}",
        course_id=course_id,
        order_index=int(next_order),
        title=body.title.strip(),
        summary=body.summary,
        content_md=body.content_md,
        video_url=body.video_url,
        estimated_minutes=body.estimated_minutes,
    )
    db.add(lesson)
    course.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(lesson)
    return _lesson_summary(db, lesson, set(), set())


@router.put("/courses/{course_id}/lessons/{lesson_id}", response_model=LessonSummary)
def update_lesson(
    course_id: str,
    lesson_id: str,
    body: LessonUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)
    lesson = db.get(Lesson, lesson_id)
    if not lesson or lesson.course_id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(lesson, k, v)
    course.updated_at = datetime.utcnow()
    db.add(lesson)
    db.commit()
    db.refresh(lesson)

    has_quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson.id).first() is not None
    return _lesson_summary(db, lesson, set(), {lesson.id} if has_quiz else set())


@router.delete("/courses/{course_id}/lessons/{lesson_id}", status_code=204)
def delete_lesson(
    course_id: str,
    lesson_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)
    lesson = db.get(Lesson, lesson_id)
    if not lesson or lesson.course_id != course_id:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson.id).first()
    if quiz:
        db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).delete(synchronize_session=False)
        db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz.id).delete(synchronize_session=False)
        db.delete(quiz)
    db.query(LessonProgress).filter(LessonProgress.lesson_id == lesson.id).delete(synchronize_session=False)
    db.delete(lesson)
    course.updated_at = datetime.utcnow()
    db.commit()
    return None


# ============================================================
# Enrollment + progress
# ============================================================
@router.post("/courses/{course_id}/enroll", response_model=EnrollmentSummary)
def enroll(course_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    if not course.published:
        raise HTTPException(status_code=400, detail="Course is unpublished.")

    existing = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user.id, Enrollment.course_id == course_id)
        .first()
    )
    if not existing:
        existing = Enrollment(user_id=user.id, course_id=course_id, enrolled_at=datetime.utcnow(), progress_pct=0)
        db.add(existing)
        db.commit()
    return EnrollmentSummary(
        course_id=course_id, enrolled_at=existing.enrolled_at, progress_pct=existing.progress_pct
    )


@router.delete("/courses/{course_id}/enroll", status_code=204)
def unenroll(course_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(Enrollment).filter(
        Enrollment.user_id == user.id, Enrollment.course_id == course_id
    ).delete(synchronize_session=False)
    db.commit()
    return None


@router.get("/me/enrollments", response_model=list[CourseSummary])
def my_enrollments(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Course)
        .join(Enrollment, Enrollment.course_id == Course.id)
        .filter(Enrollment.user_id == user.id)
        .order_by(Enrollment.enrolled_at.desc())
        .all()
    )
    name_map = _owner_name_map(db, [c.id for c in rows])
    return [_course_summary(db, c, name_map, user.id) for c in rows]


@router.post("/lessons/{lesson_id}/complete", response_model=LessonCompleteResponse)
def complete_lesson(
    lesson_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")

    existing = (
        db.query(LessonProgress)
        .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id)
        .first()
    )
    if not existing:
        db.add(LessonProgress(user_id=user.id, lesson_id=lesson_id, completed_at=datetime.utcnow()))
        _bump_engagement_on_lesson_complete(db, user)

    pct = _progress_pct(db, user.id, lesson.course_id)
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user.id, Enrollment.course_id == lesson.course_id)
        .first()
    )
    if enrollment:
        enrollment.progress_pct = pct
        db.add(enrollment)

    db.commit()
    return LessonCompleteResponse(lesson_id=lesson_id, completed=True, course_progress_pct=pct)


@router.delete("/lessons/{lesson_id}/complete", response_model=LessonCompleteResponse)
def uncomplete_lesson(
    lesson_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    db.query(LessonProgress).filter(
        LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id
    ).delete(synchronize_session=False)
    pct = _progress_pct(db, user.id, lesson.course_id)
    enrollment = (
        db.query(Enrollment)
        .filter(Enrollment.user_id == user.id, Enrollment.course_id == lesson.course_id)
        .first()
    )
    if enrollment:
        enrollment.progress_pct = pct
        db.add(enrollment)
    db.commit()
    return LessonCompleteResponse(lesson_id=lesson_id, completed=False, course_progress_pct=pct)


# ============================================================
# Quizzes
# ============================================================
@router.put("/lessons/{lesson_id}/quiz", response_model=QuizForAuthor)
def upsert_quiz(
    lesson_id: str,
    body: QuizUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    course = db.get(Course, lesson.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)

    quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson_id).first()
    if not quiz:
        quiz = Quiz(
            id=f"qz-{uuid.uuid4().hex[:10]}",
            lesson_id=lesson_id,
            title=body.title,
            passing_score=body.passing_score,
        )
        db.add(quiz)
    else:
        quiz.title = body.title
        quiz.passing_score = body.passing_score
        # Wipe old questions before replacing
        db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).delete(synchronize_session=False)

    questions_out: list[dict] = []
    for i, q in enumerate(body.questions):
        # Validate that correct_choice_id matches one of the provided choices.
        choice_ids = {c.id for c in q.choices}
        if q.correct_choice_id not in choice_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Question {i + 1}: correct_choice_id must match one of the choice ids.",
            )
        qid = f"qq-{uuid.uuid4().hex[:10]}"
        db.add(
            QuizQuestion(
                id=qid,
                quiz_id=quiz.id,
                order_index=i,
                prompt=q.prompt,
                choices_json=json.dumps([c.model_dump() for c in q.choices]),
                correct_choice_id=q.correct_choice_id,
            )
        )
        questions_out.append(
            {
                "id": qid,
                "order_index": i,
                "prompt": q.prompt,
                "choices": [c.model_dump() for c in q.choices],
                "correct_choice_id": q.correct_choice_id,
            }
        )

    db.commit()
    return QuizForAuthor(
        id=quiz.id,
        lesson_id=lesson_id,
        title=quiz.title,
        passing_score=quiz.passing_score,
        questions=questions_out,
    )


@router.delete("/lessons/{lesson_id}/quiz", status_code=204)
def delete_quiz(
    lesson_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    lesson = db.get(Lesson, lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    course = db.get(Course, lesson.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found.")
    _require_owner(user, course)

    quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson_id).first()
    if not quiz:
        return None
    db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).delete(synchronize_session=False)
    db.query(QuizAttempt).filter(QuizAttempt.quiz_id == quiz.id).delete(synchronize_session=False)
    db.delete(quiz)
    db.commit()
    return None


@router.get("/lessons/{lesson_id}/quiz", response_model=QuizForLearner | QuizForAuthor)
def get_quiz(lesson_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz on this lesson.")

    lesson = db.get(Lesson, lesson_id)
    course = db.get(Course, lesson.course_id) if lesson else None

    questions = (
        db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).order_by(QuizQuestion.order_index).all()
    )

    # Authors see the full payload (with correct answers); learners get the stripped form.
    if course and _can_edit_course(user, course):
        return QuizForAuthor(
            id=quiz.id,
            lesson_id=lesson_id,
            title=quiz.title,
            passing_score=quiz.passing_score,
            questions=[
                {
                    "id": q.id,
                    "order_index": q.order_index,
                    "prompt": q.prompt,
                    "choices": q.choices(),
                    "correct_choice_id": q.correct_choice_id,
                }
                for q in questions
            ],
        )

    best = (
        db.query(func.max(QuizAttempt.score))
        .filter(QuizAttempt.user_id == user.id, QuizAttempt.quiz_id == quiz.id)
        .scalar()
    )
    return QuizForLearner(
        id=quiz.id,
        lesson_id=lesson_id,
        title=quiz.title,
        passing_score=quiz.passing_score,
        questions=[
            {
                "id": q.id,
                "order_index": q.order_index,
                "prompt": q.prompt,
                "choices": q.choices(),
            }
            for q in questions
        ],
        best_score=int(best) if best is not None else None,
    )


@router.post("/lessons/{lesson_id}/quiz/attempt", response_model=QuizAttemptResult)
def attempt_quiz(
    lesson_id: str,
    body: QuizAttemptRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quiz = db.query(Quiz).filter(Quiz.lesson_id == lesson_id).first()
    if not quiz:
        raise HTTPException(status_code=404, detail="No quiz on this lesson.")

    questions = db.query(QuizQuestion).filter(QuizQuestion.quiz_id == quiz.id).all()
    if not questions:
        raise HTTPException(status_code=400, detail="Quiz has no questions.")

    per_question: dict[str, dict] = {}
    correct = 0
    for q in questions:
        chosen = body.answers.get(q.id)
        is_correct = chosen == q.correct_choice_id
        if is_correct:
            correct += 1
        per_question[q.id] = {"correct": is_correct, "correct_choice_id": q.correct_choice_id}

    total = len(questions)
    score = int(round(100 * correct / total))

    db.add(
        QuizAttempt(
            id=f"att-{uuid.uuid4().hex[:10]}",
            user_id=user.id,
            quiz_id=quiz.id,
            score=score,
            total=total,
            correct=correct,
            answers_json=json.dumps(body.answers),
            submitted_at=datetime.utcnow(),
        )
    )

    new_quiz_avg = _recompute_quiz_avg(db, user)

    # Passing a quiz auto-marks the lesson complete (learners can still re-attempt).
    if score >= quiz.passing_score:
        already = (
            db.query(LessonProgress)
            .filter(LessonProgress.user_id == user.id, LessonProgress.lesson_id == lesson_id)
            .first()
        )
        if not already:
            db.add(LessonProgress(user_id=user.id, lesson_id=lesson_id, completed_at=datetime.utcnow()))
            _bump_engagement_on_lesson_complete(db, user)
            lesson = db.get(Lesson, lesson_id)
            if lesson:
                pct = _progress_pct(db, user.id, lesson.course_id)
                enrollment = (
                    db.query(Enrollment)
                    .filter(Enrollment.user_id == user.id, Enrollment.course_id == lesson.course_id)
                    .first()
                )
                if enrollment:
                    enrollment.progress_pct = pct
                    db.add(enrollment)

    db.commit()
    return QuizAttemptResult(
        score=score,
        correct=correct,
        total=total,
        passed=score >= quiz.passing_score,
        per_question=per_question,
        new_quiz_avg=new_quiz_avg,
    )
