import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ciopmrwvmgqsbapyljih.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 DETAILED STORAGE INSPECTION\n');

async function inspectStorage() {
  try {
    // List all files in bucket root
    console.log('1️⃣ LISTING ROOT OF LESSON-VIDEOS BUCKET');
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('lesson-videos')
      .list('', { limit: 100 });

    if (rootError) {
      console.error('❌ Error:', rootError);
      return;
    }

    console.log(`Found ${rootFiles.length} items in root:\n`);
    rootFiles.forEach(item => {
      const type = item.metadata ? '📄' : '📁';
      console.log(`${type} ${item.name}`);
    });

    // Try listing inside "lesson-videos" subdirectory
    console.log('\n2️⃣ LISTING INSIDE lesson-videos SUBDIRECTORY');
    const { data: subFiles, error: subError } = await supabase.storage
      .from('lesson-videos')
      .list('lesson-videos', { limit: 100 });

    if (subError) {
      console.error('❌ Error:', subError.message);
    } else {
      console.log(`Found ${subFiles.length} items in lesson-videos/:\n`);
      subFiles.slice(0, 10).forEach(item => {
        const type = item.metadata ? '📄' : '📁';
        console.log(`${type} ${item.name}`);
      });
      if (subFiles.length > 10) {
        console.log(`... and ${subFiles.length - 10} more`);
      }
    }

    // Test if the files are actually accessible
    console.log('\n3️⃣ TEST FILE ACCESSIBILITY');
    const testUrls = [
      'https://ciopmrwvmgqsbapyljih.supabase.co/storage/v1/object/public/lesson-videos/lesson-8047a1d3-e549-4d74-b9d9-c593a93528ee-1788337702639-ar5a3xlj.webm',
      'https://ciopmrwvmgqsbapyljih.supabase.co/storage/v1/object/public/lesson-videos/lesson-videos/lesson-8047a1d3-e549-4d74-b9d9-c593a93528ee-1788337702639-ar5a3xlj.webm'
    ];

    for (const url of testUrls) {
      const shortPath = url.split('/lesson-videos/')[1];
      try {
        const res = await fetch(url, { method: 'HEAD' });
        console.log(`${res.ok ? '✅' : '❌'} ${shortPath}`);
      } catch (e) {
        console.log(`❌ ${shortPath} - ${e.message}`);
      }
    }

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

inspectStorage();
