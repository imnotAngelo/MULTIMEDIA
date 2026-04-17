import { Pool } from 'pg';

/**
 * Direct PostgreSQL connection to create tables
 * Bypasses Supabase SDK limitations by using node-postgres (pg)
 */
export async function createTablesDirectly() {
  // Parse Supabase connection URL
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ [MIGRATE] Missing Supabase credentials');
    return false;
  }

  // Extract database connection info from Supabase URL
  // Supabase URL format: https://[project-id].supabase.co
  // We need to construct the PostgreSQL connection string
  const projectId = supabaseUrl.replace('https://', '').split('.')[0];
  const dbHost = `db.${projectId}.supabase.co`;
  const dbPort = 5432;
  const dbName = 'postgres';
  const dbUser = 'postgres'; // Default Supabase user
  
  // For production, you'd get this from environment, but for Supabase it's typically the service key password
  const dbPassword = process.env.SUPABASE_DB_PASSWORD || supabaseKey;

  const connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`;

  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase uses SSL
  });

  try {
    console.log('🔌 [MIGRATE] Connecting to PostgreSQL directly...');
    const client = await pool.connect();
    console.log('✅ [MIGRATE] Connected to database');

    try {
      // Create tables
      console.log('📝 [MIGRATE] Creating tables...');

      const createTableSQL = `
        -- Create laboratory_phase_progress table
        CREATE TABLE IF NOT EXISTS laboratory_phase_progress (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            module_id TEXT NOT NULL,
            unit_id TEXT NOT NULL,
            phase TEXT NOT NULL CHECK (phase IN ('theory', 'interactive', 'activity', 'creative')),
            lesson_id TEXT,
            status TEXT DEFAULT 'available' CHECK (status IN ('locked', 'available', 'in_progress', 'completed')),
            xp_earned INTEGER DEFAULT 0,
            interaction_count INTEGER DEFAULT 0,
            time_spent_seconds INTEGER DEFAULT 0,
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, module_id)
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_phase_progress_user_module 
            ON laboratory_phase_progress(user_id, module_id);
        CREATE INDEX IF NOT EXISTS idx_phase_progress_user_unit 
            ON laboratory_phase_progress(user_id, unit_id);
        CREATE INDEX IF NOT EXISTS idx_phase_progress_status 
            ON laboratory_phase_progress(status);
        CREATE INDEX IF NOT EXISTS idx_phase_progress_created 
            ON laboratory_phase_progress(created_at);

        -- Enable RLS
        ALTER TABLE laboratory_phase_progress ENABLE ROW LEVEL SECURITY;

        -- Create or replace trigger function
        CREATE OR REPLACE FUNCTION public.update_timestamp()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Create trigger
        DROP TRIGGER IF EXISTS laboratory_phase_progress_updated_at 
            ON laboratory_phase_progress;
        CREATE TRIGGER laboratory_phase_progress_updated_at
        BEFORE UPDATE ON laboratory_phase_progress
        FOR EACH ROW
        EXECUTE FUNCTION public.update_timestamp();

        -- Drop old policies
        DROP POLICY IF EXISTS "service_role_all" ON laboratory_phase_progress;
        DROP POLICY IF EXISTS "phase_progress_student_read" ON laboratory_phase_progress;
        DROP POLICY IF EXISTS "phase_progress_student_insert" ON laboratory_phase_progress;
        DROP POLICY IF EXISTS "phase_progress_student_update" ON laboratory_phase_progress;

        -- Create RLS policies
        CREATE POLICY "service_role_all"
            ON laboratory_phase_progress
            AS PERMISSIVE FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);

        CREATE POLICY "phase_progress_student_read"
            ON laboratory_phase_progress
            FOR SELECT
            USING (auth.uid() = user_id);

        CREATE POLICY "phase_progress_student_insert"
            ON laboratory_phase_progress
            FOR INSERT
            WITH CHECK (auth.uid() = user_id);

        CREATE POLICY "phase_progress_student_update"
            ON laboratory_phase_progress
            FOR UPDATE
            USING (auth.uid() = user_id)
            WITH CHECK (auth.uid() = user_id);
      `;

      // Execute each statement
      const statements = createTableSQL.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            console.log(`   📋 Executing: ${statement.substring(0, 50).replace(/\n/g, ' ')}...`);
            await client.query(statement);
          } catch (err: any) {
            // Ignore "already exists" errors
            if (!err.message.includes('already exists')) {
              console.error(`   ❌ Error: ${err.message}`);
              throw err;
            }
            console.log(`   ℹ️ (Already exists, skipping)`);
          }
        }
      }

      console.log('✅ [MIGRATE] All tables created/verified successfully');
      return true;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ [MIGRATE] Failed to create tables:');
    console.error(`   ${error.message}`);
    
    // Check if it's an authentication error
    if (error.code === 'ECONNREFUSED' || error.message.includes('authentication failed')) {
      console.error('\n⚠️ [MIGRATE] Database connection failed. Possible causes:');
      console.error('   1. Incorrect database password in SUPABASE_DB_PASSWORD');
      console.error('   2. Supabase database not accessible');
      console.error('   3. Network/firewall issues');
      console.error('\n💡 To fix this, you need the database password from Supabase:');
      console.error('   1. Go to: https://app.supabase.com/project/ciopmrwvmgqsbapyljih/settings/database');
      console.error('   2. Get "Database Password" and set SUPABASE_DB_PASSWORD in .env');
      console.error('   3. Or reset the password and use the new one');
    }
    
    return false;
  } finally {
    await pool.end();
  }
}
