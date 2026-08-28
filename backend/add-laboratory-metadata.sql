    -- Run this once in the Supabase SQL editor.
    -- Creates the base table on fresh projects and upgrades older installations.
    CREATE TABLE IF NOT EXISTS laboratories (
        id TEXT PRIMARY KEY,
        instructor_id UUID NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS title TEXT;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS platform TEXT;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS platform_url TEXT;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS unit_id TEXT;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS unit_name TEXT;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 100;
    ALTER TABLE laboratories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

    CREATE INDEX IF NOT EXISTS idx_laboratories_instructor ON laboratories(instructor_id);
    CREATE INDEX IF NOT EXISTS idx_laboratories_unit ON laboratories(unit_id);

    NOTIFY pgrst, 'reload schema';