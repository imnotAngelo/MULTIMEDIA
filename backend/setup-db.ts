#!/usr/bin/env node

/**
 * ONE-TIME SETUP SCRIPT
 * Run this script ONCE to create the laboratory_phase_progress table
 * 
 * Instructions:
 * 1. You need the Supabase database password
 * 2. Get it from: https://app.supabase.com/project/ciopmrwvmgqsbapyljih/settings/database
 * 3. Set it as an environment variable before running this script:
 *    SET SUPABASE_DB_PASSWORD=your_password_here (Windows)
 *    OR
 *    export SUPABASE_DB_PASSWORD=your_password_here (Mac/Linux)
 * 4. Run: npm run setup
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
  }

  if (!dbPassword) {
    console.error('❌ MISSING DATABASE PASSWORD!');
    console.error('\n📝 TO SET IT UP:');
    console.error('1. Go to: https://app.supabase.com/project/ciopmrwvmgqsbapyljih/settings/database');
    console.error('2. Look for "Database Password"');
    console.error('3. Add this to your .env file:');
    console.error('   SUPABASE_DB_PASSWORD=<your_password_here>');
    console.error('\n4. Then run: npm run setup');
    process.exit(1);
  }

  const projectId = supabaseUrl.replace('https://', '').split('.')[0];
  const dbHost = `db.${projectId}.supabase.co`;
  const connectionString = `postgresql://postgres:${dbPassword}@${dbHost}:5432/postgres`;

  console.log('🔌 Connecting to Supabase PostgreSQL...');
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected!');

    try {
      const statements = [
        // Drop old tables
        `DROP TABLE IF EXISTS laboratory_phase_progress CASCADE`,
        `DROP TABLE IF EXISTS laboratory_progress CASCADE`,

        // Create laboratory_progress
        `CREATE TABLE laboratory_progress (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          unit_id TEXT NOT NULL,
          total_xp_earned INTEGER DEFAULT 0,
          total_completed_phases INTEGER DEFAULT 0,
          total_phases INTEGER DEFAULT 4,
          last_accessed_module_id VARCHAR(255),
          started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, unit_id)
        )`,

        // Create laboratory_phase_progress
        `CREATE TABLE laboratory_phase_progress (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          module_id TEXT NOT NULL,
          unit_id TEXT NOT NULL,
          phase TEXT NOT NULL,
          lesson_id TEXT,
          status TEXT DEFAULT 'available',
          xp_earned INTEGER DEFAULT 0,
          interaction_count INTEGER DEFAULT 0,
          time_spent_seconds INTEGER DEFAULT 0,
          started_at TIMESTAMP WITH TIME ZONE,
          completed_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, module_id)
        )`,

        // Indexes
        `CREATE INDEX idx_lab_progress_user ON laboratory_progress(user_id)`,
        `CREATE INDEX idx_lab_progress_unit ON laboratory_progress(unit_id)`,
        `CREATE INDEX idx_phase_progress_user ON laboratory_phase_progress(user_id)`,
        `CREATE INDEX idx_phase_progress_module ON laboratory_phase_progress(module_id)`,
        `CREATE INDEX idx_phase_progress_unit ON laboratory_phase_progress(unit_id)`,

        // Disable RLS so service role can access freely
        `ALTER TABLE laboratory_progress DISABLE ROW LEVEL SECURITY`,
        `ALTER TABLE laboratory_phase_progress DISABLE ROW LEVEL SECURITY`,

        // Reload PostgREST schema cache
        `SELECT pg_notify('pgrst', 'reload schema')`,
      ];

      console.log('📝 Creating tables...');

      console.log('📝 Creating table and policies...');

      for (const stmt of statements) {
        console.log('  ▶', stmt.trim().substring(0, 60).replace(/\s+/g, ' ') + '...');
        await client.query(stmt);
      }

      console.log('\n✅ ✅ ✅ SUCCESS! ✅ ✅ ✅');
      console.log('\n🎉 Both tables created:');
      console.log('   • laboratory_progress');
      console.log('   • laboratory_phase_progress');
      console.log('\n📍 Student XP and progress will now save properly.');
      console.log('   The backend (port 3001) is ready — no restart needed.');
      console.log('   Just reload the browser and test completing a module.');
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('\n❌ ERROR creating table:');
    console.error(error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Cannot connect to Supabase database');
      console.error('   Make sure you have the correct password');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
