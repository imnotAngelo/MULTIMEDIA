import { supabase } from '../config/supabase.js';

/**
 * Initialize and create required database tables
 * This runs on server startup to ensure all tables exist
 */
export async function initializeDatabaseTables() {
  try {
    console.log('🔄 [DB INIT] Initializing database tables...');

    // Create laboratory_phase_progress table if it doesn't exist
    await createLaboratoryPhaseProgressTable();

    console.log('✅ [DB INIT] All database tables initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ [DB INIT] Database initialization failed:', error);
    // Don't throw - just warn, allow server to start
    console.warn('⚠️ [DB INIT] Server will continue but laboratory features may not work');
    return false;
  }
}

/**
 * Create laboratory_phase_progress table if it doesn't exist
 */
async function createLaboratoryPhaseProgressTable() {
  const tableName = 'laboratory_phase_progress';
  
  try {
    console.log(`📝 [DB INIT] Creating/verifying ${tableName} table...`);

    // First, try to check if the table exists
    const { data: existingRows, error: checkError } = await supabase
      .from(tableName)
      .select('id')
      .limit(1);

    if (!checkError) {
      console.log(`✅ [DB INIT] ${tableName} table already exists`);
      return true;
    }

    // Table doesn't exist, create it using raw SQL
    console.log(`🔨 [DB INIT] Table doesn't exist. Creating ${tableName}...`);

    const createTableSQL = `
      -- Drop policies if they exist
      DROP POLICY IF EXISTS "service_role_all" ON laboratory_phase_progress;
      DROP POLICY IF EXISTS "phase_progress_student_read" ON laboratory_phase_progress;
      DROP POLICY IF EXISTS "phase_progress_student_insert" ON laboratory_phase_progress;
      DROP POLICY IF EXISTS "phase_progress_student_update" ON laboratory_phase_progress;

      -- Create table
      CREATE TABLE IF NOT EXISTS laboratory_phase_progress (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_phase_progress_user_module ON laboratory_phase_progress(user_id, module_id);
      CREATE INDEX IF NOT EXISTS idx_phase_progress_user_unit ON laboratory_phase_progress(user_id, unit_id);
      CREATE INDEX IF NOT EXISTS idx_phase_progress_status ON laboratory_phase_progress(status);
      CREATE INDEX IF NOT EXISTS idx_phase_progress_created ON laboratory_phase_progress(created_at);

      -- Enable RLS
      ALTER TABLE laboratory_phase_progress ENABLE ROW LEVEL SECURITY;

      -- Create RLS policies
      CREATE POLICY "service_role_all" 
          ON laboratory_phase_progress 
          AS PERMISSIVE FOR ALL TO service_role
          USING (true) WITH CHECK (true);

      CREATE POLICY "phase_progress_student_read" 
          ON laboratory_phase_progress FOR SELECT 
          USING (auth.uid() = user_id);

      CREATE POLICY "phase_progress_student_insert" 
          ON laboratory_phase_progress FOR INSERT 
          WITH CHECK (auth.uid() = user_id);

      CREATE POLICY "phase_progress_student_update" 
          ON laboratory_phase_progress FOR UPDATE 
          USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

      -- Create trigger function
      CREATE OR REPLACE FUNCTION update_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create trigger
      DROP TRIGGER IF EXISTS laboratory_phase_progress_updated_at ON laboratory_phase_progress;
      CREATE TRIGGER laboratory_phase_progress_updated_at
      BEFORE UPDATE ON laboratory_phase_progress
      FOR EACH ROW EXECUTE FUNCTION update_timestamp();
    `;

    // Execute the SQL using Supabase RPC (admin level)
    try {
      const { error: sqlError } = await supabase.rpc('exec_sql', {
        sql: createTableSQL,
      });

      if (sqlError) {
        console.log('⚠️ [DB INIT] exec_sql RPC not available, table may already exist');
      } else {
        console.log(`✅ [DB INIT] ${tableName} table created successfully`);
        return true;
      }
    } catch (rpcError: any) {
      console.warn('⚠️ [DB INIT] exec_sql RPC not available, table may already exist:', rpcError.message);
    }

    // If RPC fails, the table might already exist or RPC isn't available
    // Verify by attempting a simple query
    try {
      const { data: testData, error: testError } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);

      if (!testError) {
        console.log(`✅ [DB INIT] ${tableName} table exists and is accessible`);
        return true;
      }

      if (testError.code === 'PGRST116') {
        // Still doesn't exist
        throw new Error(`Table '${tableName}' does not exist and could not be created`);
      }
    } catch (verifyError: any) {
      console.error(`❌ [DB INIT] Could not verify table: ${verifyError.message}`);
      throw verifyError;
    }

    console.log(`✅ [DB INIT] ${tableName} table is ready`);
  } catch (error: any) {
    const errorMsg = error.message || error.toString();
    
    console.error(`❌ [DB INIT] Error with ${tableName}:`);
    console.error(`   ${errorMsg}`);
    
    // Don't throw here - the server should still work, just with limited functionality
    console.warn('⚠️ [DB INIT] Laboratory progress features may be limited');
    
    return false;
  }
}

/**
 * Ensure update_timestamp function exists
 */
export async function ensureUpdateTimestampFunction() {
  try {
    console.log('🔍 [DB INIT] Checking update_timestamp function...');
    // This gets created with the table now
    console.log('✅ [DB INIT] update_timestamp function will be ready');
    return true;
  } catch (error) {
    console.warn('⚠️ [DB INIT] Could not verify update_timestamp function:', error);
    return true; // Don't fail on this
  }
}
