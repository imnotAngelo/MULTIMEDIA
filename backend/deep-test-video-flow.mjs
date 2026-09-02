import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ciopmrwvmgqsbapyljih.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 DEEP VIDEO FLOW TEST\n');

async function runTest() {
  try {
    // 1. Check database schema
    console.log('1️⃣ CHECK DATABASE SCHEMA');
    const { data: tableInfo, error: schemaError } = await supabase
      .from('lessons')
      .select('id')
      .limit(1);
    
    if (schemaError) {
      console.error('❌ Cannot access lessons table:', schemaError);
      return;
    }
    console.log('✅ Lessons table is accessible\n');

    // 2. Check existing lessons and their video URLs
    console.log('2️⃣ CHECK ALL LESSONS IN DATABASE');
    const { data: lessons, error: lessonError } = await supabase
      .from('lessons')
      .select('id, title, video_url, app_link, app_name')
      .order('created_at', { ascending: false });

    if (lessonError) {
      console.error('❌ Error fetching lessons:', lessonError);
      return;
    }

    console.log(`📊 Found ${lessons.length} lessons:\n`);
    lessons.forEach((lesson, i) => {
      console.log(`${i + 1}. "${lesson.title}" (ID: ${lesson.id.substring(0, 12)}...)`);
      console.log(`   Video URL: ${lesson.video_url ? '✅ ' + lesson.video_url.substring(0, 80) + '...' : '❌ EMPTY'}`);
      console.log(`   App Link: ${lesson.app_link ? '✅ ' + lesson.app_link : '❌ EMPTY'}`);
      console.log('');
    });

    // 3. Analyze video URL format
    console.log('3️⃣ ANALYZE VIDEO URL FORMAT');
    const lessonWithVideo = lessons.find(l => l.video_url);
    if (lessonWithVideo) {
      const url = lessonWithVideo.video_url;
      console.log(`URL: ${url}`);
      
      // Check for double path
      if (url.includes('lesson-videos/lesson-videos')) {
        console.log('❌ FOUND DOUBLE PATH BUG!');
        console.log('   The URL contains "lesson-videos/lesson-videos"');
      } else {
        console.log('✅ URL format looks correct (single path)');
      }

      // Verify it's a Supabase public URL
      if (url.includes('supabase.co/storage/v1/object/public/lesson-videos')) {
        console.log('✅ URL is valid Supabase public URL format');
      }
      console.log('');
    } else {
      console.log('⚠️ No videos found in database\n');
    }

    // 4. Check Supabase storage bucket
    console.log('4️⃣ CHECK SUPABASE STORAGE BUCKET');
    const { data: files, error: bucketError } = await supabase.storage
      .from('lesson-videos')
      .list('', { limit: 10 });

    if (bucketError) {
      console.error('❌ Error accessing storage bucket:', bucketError);
      return;
    }

    console.log(`📁 Storage bucket "lesson-videos" has ${files.length} files:\n`);
    files.slice(0, 5).forEach((file, i) => {
      console.log(`${i + 1}. ${file.name}`);
    });
    if (files.length > 5) {
      console.log(`... and ${files.length - 5} more files`);
    }
    console.log('');

    // 5. Test public URL accessibility
    if (lessonWithVideo) {
      console.log('5️⃣ TEST PUBLIC URL ACCESSIBILITY');
      const testUrl = lessonWithVideo.video_url;
      console.log(`Testing: ${testUrl}`);
      
      try {
        const response = await fetch(testUrl, { method: 'HEAD' });
        if (response.ok) {
          console.log(`✅ URL is accessible (HTTP ${response.status})`);
        } else {
          console.log(`❌ URL returned HTTP ${response.status}`);
        }
      } catch (err) {
        console.log(`❌ URL test failed: ${err.message}`);
      }
    }
    console.log('');

    // 6. Summary and recommendations
    console.log('6️⃣ SUMMARY & RECOMMENDATIONS');
    if (!lessonWithVideo) {
      console.log('⚠️ No videos in database yet');
      console.log('   → Try uploading a new video via the instructor interface');
      console.log('   → The fixed backend should save with correct path');
    } else if (lessonWithVideo.video_url.includes('lesson-videos/lesson-videos')) {
      console.log('🔴 CRITICAL: Double path bug detected!');
      console.log('   → Backend fix deployed but old data still has wrong paths');
      console.log('   → Options:');
      console.log('      1. Upload a NEW video (will use correct path)');
      console.log('      2. Delete old lesson and re-create it');
      console.log('      3. Run migration script to fix old URLs');
    } else {
      console.log('✅ Video URLs look correct!');
      console.log('   → If still disappearing on refresh, issue is in frontend fetch logic');
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

runTest();
