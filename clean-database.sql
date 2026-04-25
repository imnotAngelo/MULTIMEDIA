-- CLEAN DATABASE SCRIPT
-- This script deletes ALL data from your multimedia learning platform
-- Run this in Supabase SQL Editor or through a database client

-- ⚠️  WARNING: This will permanently delete ALL content!
-- Make sure to backup any important data before running this.

-- Delete data from tables (in order to respect foreign key constraints)
-- Start with tables that reference others

-- Delete assessment submissions first (references assessments)
DELETE FROM assessment_submissions;

-- Delete assessments (references modules/courses)
DELETE FROM assessments;

-- Delete lesson comments first (references lessons and users)
DELETE FROM lesson_comments;

-- Delete lesson slides (references lessons)
DELETE FROM lesson_slides;

-- Delete lessons (references modules)
DELETE FROM lessons;

-- Delete modules (references courses)
DELETE FROM modules;

-- Delete courses
DELETE FROM courses;

-- Delete laboratory progress data
DELETE FROM laboratory_progress;
DELETE FROM laboratory_phase_progress;

-- Delete Canva submissions (references laboratories)
DELETE FROM canva_submissions;

-- Delete laboratories
DELETE FROM laboratories;

-- Note: We don't delete from 'users' table as it contains auth.users data
-- Only delete from users table if it's a separate table (not auth.users)

COMMIT;

-- Verification: Check that tables are empty
SELECT
    'lesson_comments' as table_name, COUNT(*) as record_count FROM lesson_comments
UNION ALL
SELECT 'lesson_slides', COUNT(*) FROM lesson_slides
UNION ALL
SELECT 'lessons', COUNT(*) FROM lessons
UNION ALL
SELECT 'modules', COUNT(*) FROM modules
UNION ALL
SELECT 'courses', COUNT(*) FROM courses
UNION ALL
SELECT 'laboratory_progress', COUNT(*) FROM laboratory_progress
UNION ALL
SELECT 'laboratory_phase_progress', COUNT(*) FROM laboratory_phase_progress
UNION ALL
SELECT 'canva_submissions', COUNT(*) FROM canva_submissions
UNION ALL
SELECT 'laboratories', COUNT(*) FROM laboratories
UNION ALL
SELECT 'assessments', COUNT(*) FROM assessments
UNION ALL
SELECT 'assessment_submissions', COUNT(*) FROM assessment_submissions;