import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function verifyAndMigrate() {
  try {
    console.log('🔍 Checking if video columns exist in lessons table...\n');

    // Try to select the columns - this will error if they don't exist
    console.log('📝 Checking video_url column...');
    const { error: error1 } = await supabase
      .from('lessons')
      .select('video_url')
      .limit(1);

    console.log('📝 Checking app_link column...');
    const { error: error2 } = await supabase
      .from('lessons')
      .select('app_link')
      .limit(1);

    console.log('📝 Checking app_name column...');
    const { error: error3 } = await supabase
      .from('lessons')
      .select('app_name')
      .limit(1);

    const hasVideoUrl = !error1 || !error1.message.includes('column');
    const hasAppLink = !error2 || !error2.message.includes('column');
    const hasAppName = !error3 || !error3.message.includes('column');

    console.log('\n📊 Column Status:');
    console.log(`   video_url: ${hasVideoUrl ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   app_link:  ${hasAppLink ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   app_name:  ${hasAppName ? '✅ EXISTS' : '❌ MISSING'}\n`);

    if (!hasVideoUrl || !hasAppLink || !hasAppName) {
      console.log('❌ MIGRATION REQUIRED\n');
      console.log('You MUST run this SQL in Supabase Dashboard:\n');
      console.log('='.repeat(70));
      console.log('GO TO: Supabase Dashboard → SQL Editor → New Query\n');
      console.log('='.repeat(70) + '\n');
      
      const sql = `ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS video_url TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS app_link TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS app_name TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_video_url 
  ON public.lessons(video_url) WHERE video_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lessons_app_link 
  ON public.lessons(app_link) WHERE app_link IS NOT NULL;`;
      
      console.log(sql);
      console.log('\n' + '='.repeat(70) + '\n');
      console.log('📋 After running the SQL:');
      console.log('   1. Wait for "Success" message');
      console.log('   2. Run this script again: node verify-and-migrate.mjs');
      console.log('   3. Restart backend: npm run dev\n');
      process.exit(1);
    } else {
      console.log('✅ All columns exist!\n');
      
      const { data: lessons } = await supabase
        .from('lessons')
        .select('id, title, video_url, app_link, app_name')
        .limit(1);
      
      if (lessons && lessons.length > 0) {
        console.log('✅ Sample lesson data:');
        console.log(JSON.stringify(lessons[0], null, 2));
      }
      
      console.log('\n✅ Database is ready! Now:');
      console.log('   1. Restart backend: npm run dev');
      console.log('   2. Try uploading a video');
      console.log('   3. Refresh - video should persist!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message || error);
    process.exit(1);
  }
}

verifyAndMigrate();
