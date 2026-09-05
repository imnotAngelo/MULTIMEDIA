-- Store quiz classification selected in manual and auto-generated quiz builders.
ALTER TABLE assessments
  ADD COLUMN IF NOT EXISTS quiz_category TEXT,
  ADD COLUMN IF NOT EXISTS quiz_type TEXT,
  ADD COLUMN IF NOT EXISTS quiz_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS question_counts_by_type JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lesson_ids UUID[] DEFAULT '{}';

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