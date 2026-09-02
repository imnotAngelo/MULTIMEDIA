-- Add year_level column to lessons table to track which semester each lesson belongs to
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

-- Add year_level column to assessments table (includes both assessments and quizzes)
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

-- Add year_level column to laboratories table
ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

-- Add comment explaining the purpose
COMMENT ON COLUMN lessons.year_level IS 'Indicates which semester/academic year this lesson belongs to. 1=1st Sem, 2=2nd Sem, 3=Summer';
COMMENT ON COLUMN assessments.year_level IS 'Indicates which semester/academic year this assessment/quiz belongs to. 1=1st Sem, 2=2nd Sem, 3=Summer';
COMMENT ON COLUMN laboratories.year_level IS 'Indicates which semester/academic year this laboratory belongs to. 1=1st Sem, 2=2nd Sem, 3=Summer';
