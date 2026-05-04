-- Lesson completion tracking
CREATE TABLE IF NOT EXISTS lesson_progress (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID         NOT NULL,
  lesson_id     UUID         NOT NULL,
  completed     BOOLEAN      NOT NULL DEFAULT TRUE,
  completed_at  TIMESTAMPTZ  DEFAULT NOW(),
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uix_lesson_progress_student_lesson
  ON lesson_progress(student_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_student
  ON lesson_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson
  ON lesson_progress(lesson_id);

ALTER TABLE lesson_progress DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
