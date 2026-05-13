export type LearnerSummary = {
  id: string;
  name: string;
  goal: string;
  current_skill_level: string;
  pace: string;
  preferred_modality: string;
  struggle_topics: string[];
  confidence_score: number;
  logins_last_14d: number;
  avg_session_min: number;
  quiz_avg: number;
  onboarding_completed: boolean;
  at_risk_score: number;
  has_dna_embedding: boolean;
};

export type LearnerDNA = LearnerSummary & {
  engagement: {
    logins_last_14d: number;
    avg_session_min: number;
    quiz_avg: number;
  };
};

export type CourseRec = {
  id: string;
  title: string;
  description: string;
  audience: string;
  prerequisites: string[];
  match_score: number;
};

export type AtRiskRow = {
  learner_id: string;
  name: string;
  goal: string;
  at_risk_score: number;
  quiz_avg: number;
  logins_last_14d: number;
};

export type AdminSummary = {
  learner_count: number;
  avg_quiz: number;
  avg_logins: number;
  at_risk_count: number;
  avg_confidence: number;
  beginner_share: number;
  weekly_insight: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: { id: string; text: string }[];
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "learner" | "instructor" | "admin" | string;
  avatar_url: string | null;
  bio: string;
  interests: string[];
  learner_id: string | null;
  auth_provider: string;
  onboarding_completed: boolean;
  created_at: string;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

// ---------- LMS ----------
export type CourseSummary = {
  id: string;
  title: string;
  description: string;
  audience: string;
  level: string;
  tags: string[];
  cover_emoji: string;
  duration_hours: number;
  published: boolean;
  owner_user_id: string | null;
  owner_name: string | null;
  lesson_count: number;
  enrolled_count: number;
  is_enrolled: boolean;
  progress_pct: number;
  created_at: string | null;
  updated_at: string | null;
};

export type LessonSummary = {
  id: string;
  course_id: string;
  order_index: number;
  title: string;
  summary: string;
  estimated_minutes: number;
  has_quiz: boolean;
  completed: boolean;
};

export type LessonDetail = LessonSummary & {
  content_md: string;
  video_url: string | null;
};

export type CourseDetail = CourseSummary & {
  prerequisites: string[];
  lessons: LessonSummary[];
};

export type QuizChoice = { id: string; text: string };

export type QuizQuestionLearner = {
  id: string;
  order_index: number;
  prompt: string;
  choices: QuizChoice[];
};

export type QuizForLearner = {
  id: string;
  lesson_id: string;
  title: string;
  passing_score: number;
  questions: QuizQuestionLearner[];
  best_score: number | null;
};

export type QuizQuestionAuthor = {
  id?: string;
  order_index?: number;
  prompt: string;
  choices: QuizChoice[];
  correct_choice_id: string;
};

export type QuizForAuthor = {
  id: string;
  lesson_id: string;
  title: string;
  passing_score: number;
  questions: QuizQuestionAuthor[];
};

export type QuizAttemptResult = {
  score: number;
  correct: number;
  total: number;
  passed: boolean;
  per_question: Record<string, { correct: boolean; correct_choice_id: string }>;
  new_quiz_avg: number | null;
};
