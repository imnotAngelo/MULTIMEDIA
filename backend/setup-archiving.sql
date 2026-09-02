-- ============================================================
-- SEMESTER ARCHIVING SETUP - Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add year_level columns to all content tables
-- This allows tracking which semester each piece of content belongs to

ALTER TABLE lessons 
ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

ALTER TABLE assessments 
ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

ALTER TABLE laboratories 
ADD COLUMN IF NOT EXISTS year_level SMALLINT DEFAULT 1 CHECK (year_level IS NULL OR year_level BETWEEN 1 AND 3);

ALTER TABLE laboratories
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

-- Step 2: Tag existing content with default semester (1st Sem)
-- This ensures all existing content is tagged so archiving can work

UPDATE lessons 
SET year_level = 1 
WHERE year_level IS NULL;

UPDATE assessments 
SET year_level = 1 
WHERE year_level IS NULL;

UPDATE laboratories 
SET year_level = 1 
WHERE year_level IS NULL;

-- Step 3: Verify columns exist and have data
-- Run these to check if setup was successful

-- Check lessons table
SELECT 
  COUNT(*) as total_lessons,
  COUNT(DISTINCT year_level) as distinct_year_levels,
  string_agg(DISTINCT year_level::TEXT, ', ' ORDER BY year_level::TEXT) as year_levels_present
FROM lessons;

-- Check assessments table  
SELECT 
  COUNT(*) as total_assessments,
  COUNT(DISTINCT year_level) as distinct_year_levels,
  string_agg(DISTINCT year_level::TEXT, ', ' ORDER BY year_level::TEXT) as year_levels_present
FROM assessments;

-- Check laboratories table
SELECT 
  COUNT(*) as total_laboratories,
  COUNT(DISTINCT year_level) as distinct_year_levels,
  string_agg(DISTINCT year_level::TEXT, ', ' ORDER BY year_level::TEXT) as year_levels_present
FROM laboratories;

-- Sample data check
SELECT *
FROM (
  SELECT 'lessons' AS table_name, id::text, title, year_level, status
  FROM lessons
  UNION ALL
  SELECT 'assessments' AS table_name, id::text, title, year_level, status
  FROM assessments
  UNION ALL
  SELECT 'laboratories' AS table_name, id::text, title, year_level, status
  FROM laboratories
) AS sample_data
LIMIT 9;
