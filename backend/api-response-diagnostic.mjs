import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ciopmrwvmgqsbapyljih.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 API RESPONSE DIAGNOSTIC\n');

async function testApiResponse() {
  try {
    // Get a lesson directly from database (what backend should return)
    console.log('1️⃣ FETCH LESSON DIRECTLY FROM DATABASE');
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('id, title, content, slides, slide_count, created_at, status, target_sections, target_year_levels, video_url, app_link, app_name, pdf_url, original_format')
      .eq('id', '8047a1d3-e549-4d74-b9d9-c593a93528ee')
      .single();

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (lesson) {
      console.log('✅ Database Query Result:');
      console.log(`   ID: ${lesson.id}`);
      console.log(`   Title: ${lesson.title}`);
      console.log(`   Video URL: ${lesson.video_url ? '✅ ' + lesson.video_url.substring(0, 100) + '...' : '❌ EMPTY'}`);
      console.log(`   App Link: ${lesson.app_link || '❌ EMPTY'}`);
      console.log(`   App Name: ${lesson.app_name || '❌ EMPTY'}`);
      console.log('\n✅ All fields are being returned from database\n');
    } else {
      console.log('❌ No lesson found\n');
    }

    // Check the backend controller's getUnitLessons logic
    console.log('2️⃣ VERIFY BACKEND CONTROLLER MAPPING');
    console.log('Check: backend/src/controllers/unitsController.ts');
    console.log('Function: getUnitLessons()');
    console.log('Lines 433-473 (archived lessons mapping)');
    console.log('');
    console.log('The mapping should include:');
    console.log('  ✓ video_url');
    console.log('  ✓ app_link');
    console.log('  ✓ app_name');
    console.log('');
    console.log('This is CRITICAL - if these are missing from the response mapping,');
    console.log('the frontend will not receive video_url even if it\'s in the database!');
    console.log('');

    // Frontend storage verification
    console.log('3️⃣ FRONTEND STATE MANAGEMENT');
    console.log('Check: app/src/pages/instructor/CoursesManagement.tsx');
    console.log('When lessons are fetched, they\'re stored in state via:');
    console.log('  setLessons(prev => ({ ...lesson, video_url, ... }))');
    console.log('');
    console.log('The frontend component receives activeLesson object');
    console.log('Must check: activeLesson.video_url !== undefined');
    console.log('');

    // Rendering logic
    console.log('4️⃣ RENDERING LOGIC');
    console.log('Check: app/src/pages/student/Lessons.tsx');
    console.log('Lines 340-385 show Media & Tools section:');
    console.log('');
    console.log('if (activeLesson.video_url || activeLesson.app_link) {');
    console.log('  // render video player and links');
    console.log('}');
    console.log('');
    console.log('IF THIS CONDITION IS FALSE, VIDEO WON\'T SHOW!');
    console.log('Reasons it could be false:');
    console.log('  1. Backend is not returning video_url field');
    console.log('  2. Frontend is not receiving it from API');
    console.log('  3. State is not being updated with the field');
    console.log('  4. activeLesson is a stale copy from before videos were added');
    console.log('');

    console.log('5️⃣ ROOT CAUSE ANALYSIS');
    console.log('Videos disappear on refresh when:');
    console.log('  • Page loads');
    console.log('  • Lessons API is called');
    console.log('  • State is set with lesson data');
    console.log('  • Component tries to render video_url');
    console.log('  • If field is missing → condition fails → video not shown');
    console.log('  • On refresh: new fetch, new state set');
    console.log('  • If field still missing → video still gone');
    console.log('');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

testApiResponse();
