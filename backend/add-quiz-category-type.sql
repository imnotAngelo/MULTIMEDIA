-- Store quiz classification selected in manual and auto-generated quiz builders.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS quiz_category TEXT,
  ADD COLUMN IF NOT EXISTS quiz_type TEXT,
  ADD COLUMN IF NOT EXISTS quiz_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS question_counts_by_type JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lesson_ids UUID[] DEFAULT '{}';

-- Keep existing rows valid while making the new quiz configuration queryable.
UPDATE assessments
SET quiz_types = COALESCE(quiz_types, '{}'),
    question_counts_by_type = COALESCE(question_counts_by_type, '{}'::jsonb),
    lesson_ids = COALESCE(lesson_ids, '{}')
WHERE quiz_types IS NULL
   OR question_counts_by_type IS NULL
   OR lesson_ids IS NULL;

CREATE INDEX IF NOT EXISTS idx_assessments_quiz_category
  ON assessments(quiz_category);

CREATE INDEX IF NOT EXISTS idx_assessments_lesson_ids
  ON assessments USING GIN(lesson_ids);

ALTER TABLE assessments
  DROP CONSTRAINT IF EXISTS assessments_quiz_category_check;

ALTER TABLE assessments
  ADD CONSTRAINT assessments_quiz_category_check
  CHECK (quiz_category IS NULL OR quiz_category IN ('short', 'long', 'exam'));

ALTER TABLE assessments
  DROP CONSTRAINT IF EXISTS assessments_quiz_type_check;

ALTER TABLE assessments
  ADD CONSTRAINT assessments_quiz_type_check
  CHECK (quiz_type IS NULL OR quiz_type IN ('multiple-choice', 'enumeration', 'true-false', 'identification', 'essay'));

ALTER TABLE assessments
  DROP CONSTRAINT IF EXISTS assessments_quiz_types_check;

ALTER TABLE assessments
  ADD CONSTRAINT assessments_quiz_types_check
  CHECK (quiz_types <@ ARRAY['multiple-choice', 'enumeration', 'true-false', 'identification', 'essay']::TEXT[]);

-- Question-count keys and ranges are validated by the quiz creation flow,
-- because PostgreSQL CHECK constraints cannot contain row-returning subqueries.