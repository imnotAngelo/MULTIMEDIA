import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY not set in .env');
  console.log('Make sure SUPABASE_SERVICE_KEY is in your .env file');
  process.exit(1);
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupStorageBuckets() {
  try {
    console.log('🔧 Setting up storage buckets...');

    // Create lesson-videos bucket
    console.log('📹 Creating lesson-videos bucket...');
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('❌ Failed to list buckets:', listError);
      return;
    }

    const videoBucketExists = buckets?.some(b => b.name === 'lesson-videos');

    if (!videoBucketExists) {
      const { data, error } = await supabase.storage.createBucket('lesson-videos', {
        public: true,
        allowedMimeTypes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
      });

      if (error) {
        console.error('❌ Failed to create lesson-videos bucket:', error);
      } else {
        console.log('✅ Created lesson-videos bucket');
      }
    } else {
      console.log('✅ lesson-videos bucket already exists');
    }

    // Create avatars bucket if it doesn't exist
    const avatarBucketExists = buckets?.some(b => b.name === 'avatars');
    if (!avatarBucketExists) {
      const { error } = await supabase.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      });

      if (error) {
        console.error('❌ Failed to create avatars bucket:', error);
      } else {
        console.log('✅ Created avatars bucket');
      }
    } else {
      console.log('✅ avatars bucket already exists');
    }

    console.log('✅ Storage buckets setup complete!');
  } catch (error) {
    console.error('❌ Error setting up buckets:', error);
    process.exit(1);
  }
}

setupStorageBuckets();
