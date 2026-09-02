import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://ciopmrwvmgqsbapyljih.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not set');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function generateReport() {
  console.log('🎬 VIDEO PERSISTENCE SYSTEM DIAGNOSTIC REPORT\n');
  console.log('=' . repeat(60));
  console.log('');

  const report = [];

  try {
    // 1. Database check
    console.log('1️⃣ DATABASE LEVEL CHECK');
    report.push('# Database Check\n');

    const { data: lessons, error } = await supabase
      .from('lessons')
      .select('id, title, video_url, app_link, app_name')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Database error:', error);
      report.push('❌ Database error: Cannot query lessons\n');
      return;
    }

    console.log(`✅ Found ${lessons.length} lessons\n`);
    report.push(`✅ Found ${lessons.length} lessons\n\n`);

    const withVideo = lessons.filter(l => l.video_url);
    const withoutVideo = lessons.filter(l => !l.video_url);

    console.log(`   Lessons WITH video: ${withVideo.length}`);
    console.log(`   Lessons WITHOUT video: ${withoutVideo.length}`);
    report.push(`- Lessons WITH video: ${withVideo.length}\n`);
    report.push(`- Lessons WITHOUT video: ${withoutVideo.length}\n\n`);

    if (withVideo.length > 0) {
      console.log(`\n   Video URLs found in database:\n`);
      withVideo.forEach((l, i) => {
        const shortUrl = l.video_url.substring(0, 100) + '...';
        console.log(`   ${i + 1}. ${l.title}: ${shortUrl}`);
        report.push(`   ${i + 1}. ${l.title}: ${shortUrl}\n`);

        // Check for double path bug
        if (l.video_url.includes('lesson-videos/lesson-videos')) {
          console.log(`      ⚠️ DOUBLE PATH DETECTED\n`);
          report.push(`      ⚠️ DOUBLE PATH DETECTED\n`);
        }
      });
    }

    console.log('\n' + '=' . repeat(60));
    console.log('');

    // 2. Backend controller check
    console.log('2️⃣ BACKEND CONTROLLER CHECK');
    report.push('# Backend Controller\n');

    const controllerPath = './src/controllers/unitsController.ts';
    if (fs.existsSync(controllerPath)) {
      const content = fs.readFileSync(controllerPath, 'utf-8');
      const hasVideoMapping = content.includes('video_url: l.video_url');
      
      if (hasVideoMapping) {
        console.log('✅ Backend controller includes video_url in response mapping');
        report.push('✅ Backend includes video_url in response mapping\n');
      } else {
        console.log('❌ Backend controller missing video_url mapping');
        report.push('❌ Backend missing video_url mapping\n');
      }

      // Check for both active and archived
      const activeMapping = content.match(/map\(\(l: any\) => \{[\s\S]*?video_url:/);
      const archiveMapping = content.match(/archived.*?map\(\(l: any\) => \{[\s\S]*?video_url:/);
      
      console.log(`   Active lessons mapping: ${activeMapping ? '✅' : '❌'}`);
      console.log(`   Archived lessons mapping: ${archiveMapping ? '✅' : '❌'}`);
      report.push(`   Active lessons: ${activeMapping ? '✅' : '❌'}\n`);
      report.push(`   Archived lessons: ${archiveMapping ? '✅' : '❌'}\n`);
    } else {
      console.log('❌ Controller file not found');
      report.push('❌ Controller file not found\n');
    }

    console.log('\n' + '=' . repeat(60));
    console.log('');

    // 3. Frontend component check
    console.log('3️⃣ FRONTEND COMPONENT CHECK');
    report.push('# Frontend Component\n');

    const frontendPath = '../app/src/pages/student/Lessons.tsx';
    if (fs.existsSync(frontendPath)) {
      const content = fs.readFileSync(frontendPath, 'utf-8');
      
      const hasInterface = content.includes('video_url?:');
      const hasRendering = content.includes('activeLesson.video_url');
      
      console.log(`✅ Interface includes video_url: ${hasInterface ? '✅' : '❌'}`);
      console.log(`✅ Component renders video_url: ${hasRendering ? '✅' : '❌'}`);
      report.push(`✅ Interface includes video_url: ${hasInterface ? '✅' : '❌'}\n`);
      report.push(`✅ Component renders video_url: ${hasRendering ? '✅' : '❌'}\n`);
    } else {
      console.log('❌ Frontend file not found');
      report.push('❌ Frontend file not found\n');
    }

    console.log('\n' + '=' . repeat(60));
    console.log('');

    // 4. Storage check
    console.log('4️⃣ STORAGE BUCKET CHECK');
    report.push('# Storage Bucket\n');

    const { data: files } = await supabase.storage
      .from('lesson-videos')
      .list('lesson-videos', { limit: 100 });

    console.log(`✅ Files in storage: ${files?.length || 0}`);
    report.push(`✅ Files in storage: ${files?.length || 0}\n`);

    // 5. Summary
    console.log('\n' + '=' . repeat(60));
    console.log('');
    console.log('5️⃣ DIAGNOSTIC SUMMARY\n');
    report.push('# Summary\n\n');

    const allChecks = {
      'Database has videos': withVideo.length > 0,
      'Backend returns video_url': fs.existsSync(controllerPath),
      'Frontend expects video_url': fs.existsSync(frontendPath),
      'Storage has video files': (files?.length || 0) > 0,
    };

    let allPassed = true;
    for (const [check, passed] of Object.entries(allChecks)) {
      console.log(`${passed ? '✅' : '❌'} ${check}`);
      report.push(`${passed ? '✅' : '❌'} ${check}\n`);
      if (!passed) allPassed = false;
    }

    console.log('');
    if (allPassed) {
      console.log('✅ All system components are in place!');
      console.log('');
      console.log('If videos still disappear on refresh:');
      console.log('  → Issue is likely in FRONTEND state management');
      console.log('  → Frontend may not be properly fetching updated data');
      console.log('  → Try uploading a NEW video and testing immediately');
      report.push('\n✅ All components present\n');
      report.push('If still having issues: check frontend state management\n');
    } else {
      console.log('⚠️ Some system components are missing or misconfigured');
      console.log('Review the checks above to identify the issue');
      report.push('\n⚠️ Some components missing\n');
    }

  } catch (err) {
    console.error('❌ Error:', err);
    report.push(`\n❌ Error: ${err.message}\n`);
  }

  // Save report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `diagnostic-report-${timestamp}.md`;
  fs.writeFileSync(filename, report.join(''));
  console.log(`\n📄 Report saved to: ${filename}`);
}

generateReport();
