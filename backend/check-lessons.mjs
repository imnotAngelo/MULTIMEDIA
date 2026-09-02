import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkLessons() {
  try {
    console.log('🔍 Checking ALL lessons with their video URLs...\n');

    const { data: allLessons, error } = await supabase
      .from('lessons')
      .select('id, title, video_url, app_link, app_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ Error fetching lessons:', error.message);
      process.exit(1);
    }

    if (!allLessons || allLessons.length === 0) {
      console.log('❌ No lessons found in database');
      process.exit(1);
    }

    console.log(`📊 Found ${allLessons.length} lessons:\n`);
    
    allLessons.forEach((lesson, idx) => {
      console.log(`${idx + 1}. ${lesson.title}`);
      console.log(`   ID: ${lesson.id}`);
      console.log(`   Video URL: ${lesson.video_url ? '✅ ' + lesson.video_url : '❌ EMPTY'}`);
      console.log(`   App Link: ${lesson.app_link ? '✅ ' + lesson.app_link : '❌ EMPTY'}`);
      console.log(`   App Name: ${lesson.app_name || '❌ EMPTY'}`);
      console.log('');
    });

    // Check if any videos exist
    const lessonsWithVideo = allLessons.filter(l => l.video_url);
    console.log(`\n📈 Summary: ${lessonsWithVideo.length}/${allLessons.length} lessons have videos`);

    if (lessonsWithVideo.length === 0) {
      console.log('\n⚠️  NO VIDEOS FOUND IN DATABASE');
      console.log('   This means the upload endpoint is NOT saving to the database!');
      console.log('\n📋 Debugging steps:');
      console.log('   1. Try uploading a video');
      console.log('   2. Check backend logs for errors');
      console.log('   3. Run this script again: node check-lessons.mjs');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLessons();
