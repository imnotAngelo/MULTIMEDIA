-- Instructor accounts require administrator approval before they can sign in.
ALTER TABLE users
ADD COLUMN IF NOT EXISTS instructor_approved boolean NOT NULL DEFAULT true;

-- Existing instructors remain active; new registrations explicitly set false.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS section text;

ALTER TABLE modules
ADD COLUMN IF NOT EXISTS year_level smallint;

ALTER TABLE modules
ADD COLUMN IF NOT EXISTS section text;

ALTER TABLE modules
DROP CONSTRAINT IF EXISTS modules_year_level_valid;

ALTER TABLE modules
ADD CONSTRAINT modules_year_level_valid
CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 4);

ALTER TABLE users
DROP CONSTRAINT IF EXISTS users_section_length;

ALTER TABLE users
ADD CONSTRAINT users_section_length CHECK (section IS NULL OR char_length(trim(section)) BETWEEN 1 AND 50);

NOTIFY pgrst, 'reload schema';