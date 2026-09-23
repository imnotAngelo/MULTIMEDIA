-- Run once in the Supabase SQL Editor.
-- Stores the instructor responsible for each uploaded laboratory submission.
ALTER TABLE lab_file_submissions
ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE lab_file_submissions
ADD COLUMN IF NOT EXISTS grade NUMERIC;

ALTER TABLE lab_file_submissions
ADD COLUMN IF NOT EXISTS feedback TEXT;

ALTER TABLE lab_file_submissions
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted';

UPDATE lab_file_submissions
SET status = 'reviewed'
WHERE grade IS NOT NULL
	AND (status IS NULL OR status IN ('pending', 'submitted'));

CREATE INDEX IF NOT EXISTS idx_lab_file_submissions_instructor
ON lab_file_submissions(instructor_id);

NOTIFY pgrst, 'reload schema';