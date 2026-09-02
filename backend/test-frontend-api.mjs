// This test simulates what the frontend does when loading lessons

async function testFrontendFetch() {
  console.log('🔍 SIMULATING FRONTEND API CALL\n');

  try {
    // Simulate getting the auth token (in real app, it's from localStorage)
    const token = process.env.TEST_AUTH_TOKEN || 'test-token';
    console.log('1️⃣ Using token:', token.substring(0, 20) + '...\n');

    // Step 1: Fetch units (same as frontend)
    console.log('2️⃣ Fetching units from API...');
    const unitsResponse = await fetch('http://localhost:3001/api/units', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!unitsResponse.ok) {
      console.error(`❌ Units API failed: HTTP ${unitsResponse.status}`);
      const errorText = await unitsResponse.text();
      console.error('Response:', errorText);
      return;
    }

    const unitsData = await unitsResponse.json();
    console.log(`✅ Got ${unitsData.data?.length || 0} units\n`);

    // Step 2: Fetch lessons for first unit (same as frontend)
    if (unitsData.data && unitsData.data.length > 0) {
      const firstUnit = unitsData.data[0];
      console.log(`3️⃣ Fetching lessons for unit: "${firstUnit.title}"\n`);

      const lessonsResponse = await fetch(`http://localhost:3001/api/units/${firstUnit.id}/lessons`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!lessonsResponse.ok) {
        console.error(`❌ Lessons API failed: HTTP ${lessonsResponse.status}`);
        const errorText = await lessonsResponse.text();
        console.error('Response:', errorText);
        return;
      }

      const lessonsData = await lessonsResponse.json();
      console.log(`✅ Got ${lessonsData.data?.length || 0} lessons\n`);

      // Check each lesson for video fields
      if (lessonsData.data && lessonsData.data.length > 0) {
        console.log('4️⃣ CHECKING FIRST LESSON FOR VIDEO FIELDS:\n');
        const lesson = lessonsData.data[0];
        
        console.log(`Lesson: "${lesson.title}" (ID: ${lesson.id.substring(0, 12)}...)`);
        console.log(`Fields present: ${Object.keys(lesson).join(', ')}\n`);

        console.log('Video-related fields:');
        console.log(`  ✓ video_url: ${lesson.video_url ? '✅ ' + lesson.video_url.substring(0, 80) + '...' : '❌ MISSING'}`);
        console.log(`  ✓ app_link: ${lesson.app_link ? '✅ ' + lesson.app_link : '❌ MISSING'}`);
        console.log(`  ✓ app_name: ${lesson.app_name ? '✅ ' + lesson.app_name : '❌ MISSING'}`);

        // Check which lessons have videos
        console.log('\n5️⃣ ALL LESSONS AND THEIR VIDEO STATUS:\n');
        lessonsData.data.forEach((les: any, i: number) => {
          const hasVideo = les.video_url ? '✅' : '❌';
          console.log(`${i + 1}. "${les.title}" - ${hasVideo} Video`);
          if (les.video_url) {
            console.log(`   → ${les.video_url.substring(0, 100)}...`);
          }
        });

        console.log('\n6️⃣ ANALYSIS:\n');
        const videosCount = lessonsData.data.filter((l: any) => l.video_url).length;
        if (videosCount === 0) {
          console.log('❌ PROBLEM: No videos are being returned by the API!');
          console.log('   Possible causes:');
          console.log('   1. Backend controller is not including video_url in response');
          console.log('   2. Database query is not selecting video_url column');
          console.log('   3. Videos are in database but not being sent to frontend');
        } else {
          console.log(`✅ ${videosCount} lessons have videos in API response`);
          console.log('   If videos still disappear on refresh in UI:');
          console.log('   1. Check frontend state management');
          console.log('   2. Verify component is receiving video_url prop');
          console.log('   3. Check rendering conditional logic');
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

testFrontendFetch();
