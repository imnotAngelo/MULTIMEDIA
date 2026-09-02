import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('🔧 Running database migration...');
    console.log('📝 Adding video_url, app_link, app_name columns to lessons table...');

    const { data, error } = await supabase.rpc('sql', {
      query: `
        ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS video_url TEXT,
        ADD COLUMN IF NOT EXISTS app_link TEXT,
        ADD COLUMN IF NOT EXISTS app_name TEXT;

        CREATE INDEX IF NOT EXISTS idx_lessons_video_url ON lessons(video_url) WHERE video_url IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_lessons_app_link ON lessons(app_link) WHERE app_link IS NOT NULL;

        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'lessons' AND column_name IN ('video_url', 'app_link', 'app_name');
      `,
    });

    if (error) {
      console.error('❌ Migration failed (RPC method not available)');
      console.log('📌 You need to run the SQL manually in Supabase dashboard');
      console.log('\n📋 SQL to run:');
      console.log(`
        ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS video_url TEXT,
        ADD COLUMN IF NOT EXISTS app_link TEXT,
        ADD COLUMN IF NOT EXISTS app_name TEXT;

        CREATE INDEX IF NOT EXISTS idx_lessons_video_url ON lessons(video_url) WHERE video_url IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_lessons_app_link ON lessons(app_link) WHERE app_link IS NOT NULL;
      `);
      return;
    }

    console.log('✅ Database migration complete!');
    console.log('Columns added to lessons table:');
    console.log(data);
  } catch (error) {
    console.error('❌ Error running migration:', error);
    console.log('\n📌 Please run the SQL manually in Supabase dashboard:');
    console.log(`
      ALTER TABLE lessons
      ADD COLUMN IF NOT EXISTS video_url TEXT,
      ADD COLUMN IF NOT EXISTS app_link TEXT,
      ADD COLUMN IF NOT EXISTS app_name TEXT;

      CREATE INDEX IF NOT EXISTS idx_lessons_video_url ON lessons(video_url) WHERE video_url IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_lessons_app_link ON lessons(app_link) WHERE app_link IS NOT NULL;
    `);
  }
}

runMigration();
