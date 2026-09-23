-- Permanent migration for laboratory progress tracking.
-- Safe to run more than once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS laboratory_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  unit_id TEXT NOT NULL,
  total_xp_earned INTEGER DEFAULT 0,
  total_completed_phases INTEGER DEFAULT 0,
  total_phases INTEGER DEFAULT 4,
  last_accessed_module_id VARCHAR(255),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, unit_id)
);

CREATE TABLE IF NOT EXISTS laboratory_phase_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('theory', 'interactive', 'activity', 'creative')),
  lesson_id TEXT,
  status TEXT DEFAULT 'available' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
  xp_earned INTEGER DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_progress_user ON laboratory_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_progress_unit ON laboratory_progress(unit_id);
CREATE INDEX IF NOT EXISTS idx_phase_progress_user ON laboratory_phase_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_phase_progress_module ON laboratory_phase_progress(module_id);
CREATE INDEX IF NOT EXISTS idx_phase_progress_unit ON laboratory_phase_progress(unit_id);

ALTER TABLE laboratory_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_phase_progress DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
