from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# --- Course ---
class CourseOut(BaseModel):
    """Compact form used by the recommendations endpoint."""

    id: str
    title: str
    description: str
    audience: str
    prerequisites: list[str]
    match_score: float


class CourseSummary(BaseModel):
    """Catalog/listing shape — adds metadata used by the new LMS UI."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    description: str
    audience: str
    level: str
    tags: list[str]
    cover_emoji: str
    duration_hours: int
    published: bool
    owner_user_id: str | None
    owner_name: str | None
    lesson_count: int
    enrolled_count: int
    is_enrolled: bool = False
    progress_pct: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class CourseCreate(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(default="", max_length=4000)
    audience: str = Field(default="", max_length=1000)
    level: str = Field(default="beginner")
    tags: list[str] = Field(default_factory=list)
    prerequisites: list[str] = Field(default_factory=list)
    cover_emoji: str = "📘"
    duration_hours: int = Field(default=6, ge=1, le=400)
    published: bool = True


class CourseUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=200)
    description: str | None = None
    audience: str | None = None
    level: str | None = None
    tags: list[str] | None = None
    prerequisites: list[str] | None = None
    cover_emoji: str | None = None
    duration_hours: int | None = Field(default=None, ge=1, le=400)
    published: bool | None = None


# --- Lesson ---
class LessonSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    course_id: str
    order_index: int
    title: str
    summary: str
    estimated_minutes: int
    has_quiz: bool
    completed: bool = False


class LessonDetail(LessonSummary):
    content_md: str
    video_url: str | None = None


class LessonCreate(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    summary: str = Field(default="", max_length=1000)
    content_md: str = Field(default="", max_length=20000)
    video_url: str | None = None
    estimated_minutes: int = Field(default=15, ge=1, le=600)


class LessonUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    summary: str | None = None
    content_md: str | None = None
    video_url: str | None = None
    estimated_minutes: int | None = Field(default=None, ge=1, le=600)


class LessonReorderItem(BaseModel):
    id: str
    order_index: int


class LessonReorderRequest(BaseModel):
    items: list[LessonReorderItem]


# --- Course detail (single GET) ---
class CourseDetail(CourseSummary):
    prerequisites: list[str]
    lessons: list[LessonSummary]


# --- Enrollment / progress ---
class EnrollmentSummary(BaseModel):
    course_id: str
    enrolled_at: datetime
    progress_pct: int


class LessonCompleteResponse(BaseModel):
    lesson_id: str
    completed: bool
    course_progress_pct: int


# --- Quiz ---
class QuizChoice(BaseModel):
    id: str
    text: str


class QuizQuestionAuthor(BaseModel):
    """Author-side question — includes the correct answer."""

    prompt: str = Field(min_length=2, max_length=1000)
    choices: list[QuizChoice]
    correct_choice_id: str


class QuizUpsert(BaseModel):
    title: str = Field(default="Lesson check", min_length=1, max_length=200)
    passing_score: int = Field(default=70, ge=0, le=100)
    questions: list[QuizQuestionAuthor]


class QuizQuestionLearner(BaseModel):
    """Learner-facing question — strips the correct answer."""

    id: str
    order_index: int
    prompt: str
    choices: list[QuizChoice]


class QuizForLearner(BaseModel):
    id: str
    lesson_id: str
    title: str
    passing_score: int
    questions: list[QuizQuestionLearner]
    best_score: int | None = None


class QuizForAuthor(BaseModel):
    id: str
    lesson_id: str
    title: str
    passing_score: int
    questions: list[dict]  # full questions incl. correct_choice_id


class QuizAttemptRequest(BaseModel):
    answers: dict[str, str]  # {question_id: chosen_choice_id}


class QuizAttemptResult(BaseModel):
    score: int
    correct: int
    total: int
    passed: bool
    per_question: dict[str, dict]  # {question_id: {"correct": bool, "correct_choice_id": str}}
    new_quiz_avg: int | None = None
