-- Run once in the Supabase SQL Editor.
-- Stores the instructor responsible for each uploaded laboratory submission.
ALTER TABLE lab_file_submissions
ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_file_submissions_instructor
ON lab_file_submissions(instructor_id);

NOTIFY pgrst, 'reload schema';