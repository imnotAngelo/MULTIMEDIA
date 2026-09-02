-- Add video and app management fields to lessons table
-- This migration adds support for video URLs and app links for lessons

-- Add columns if they don't exist
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS app_link TEXT,
ADD COLUMN IF NOT EXISTS app_name TEXT;

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_lessons_video_url ON lessons(video_url) WHERE video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_app_link ON lessons(app_link) WHERE app_link IS NOT NULL;

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'lessons' AND column_name IN ('video_url', 'app_link', 'app_name');
