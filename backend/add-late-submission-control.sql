-- Allow instructors to reopen expired quizzes and laboratories.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS allow_late_submissions boolean NOT NULL DEFAULT false;

ALTER TABLE laboratories
  ADD COLUMN IF NOT EXISTS allow_late_submissions boolean NOT NULL DEFAULT false;
