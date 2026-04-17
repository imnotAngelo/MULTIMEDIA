/**
 * Creates laboratory progress tables in Supabase using the Management API.
 * No database password needed — just a personal access token.
 *
 * STEPS:
 * 1. Go to: https://app.supabase.com/account/tokens
 * 2. Click "Generate new token", copy it
 * 3. Run: node create-lab-tables.mjs YOUR_TOKEN_HERE
 */

import https from 'https';

const PROJECT_REF = 'ciopmrwvmgqsbapyljih';
const token = process.argv[2];

if (!token) {
  console.error('\n❌ Missing access token!\n');
  console.error('Steps:');
  console.error('  1. Go to: https://app.supabase.com/account/tokens');
  console.error('  2. Click "Generate new token" and copy it');
  console.error('  3. Run: node create-lab-tables.mjs YOUR_TOKEN_HERE\n');
  process.exit(1);
}

const sql = `
DROP TABLE IF EXISTS laboratory_phase_progress CASCADE;
DROP TABLE IF EXISTS laboratory_progress CASCADE;

CREATE TABLE laboratory_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  unit_id TEXT NOT NULL,
  total_xp_earned INTEGER DEFAULT 0,
  total_completed_phases INTEGER DEFAULT 0,
  total_phases INTEGER DEFAULT 4,
  last_accessed_module_id VARCHAR(255),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, unit_id)
);

CREATE TABLE laboratory_phase_progress (
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
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, module_id)
);

CREATE INDEX idx_lab_progress_user ON laboratory_progress(user_id);
CREATE INDEX idx_lab_progress_unit ON laboratory_progress(unit_id);
CREATE INDEX idx_phase_progress_user ON laboratory_phase_progress(user_id);
CREATE INDEX idx_phase_progress_module ON laboratory_phase_progress(module_id);
CREATE INDEX idx_phase_progress_unit ON laboratory_phase_progress(unit_id);

ALTER TABLE laboratory_progress DISABLE ROW LEVEL SECURITY;
ALTER TABLE laboratory_phase_progress DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
`;

const body = JSON.stringify({ query: sql });

const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('🔌 Connecting to Supabase Management API...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('\n✅ SUCCESS! Both tables created:');
      console.log('   • laboratory_progress');
      console.log('   • laboratory_phase_progress');
      console.log('\n🎉 Progress will now save to database properly.');
      console.log('   No backend restart needed — reload your browser and test.\n');
    } else if (res.statusCode === 401) {
      console.error('\n❌ Invalid token (401). Make sure you copied the full token.\n');
    } else if (res.statusCode === 403) {
      console.error('\n❌ Token does not have permission (403).');
      console.error('   Make sure you are generating an "Access Token" (not an API key).\n');
    } else {
      console.error(`\n❌ Failed (HTTP ${res.statusCode}):`);
      try {
        const parsed = JSON.parse(data);
        console.error(JSON.stringify(parsed, null, 2));
      } catch {
        console.error(data);
      }
    }
  });
});

req.on('error', (e) => {
  console.error('\n❌ Network error:', e.message, '\n');
});

req.write(body);
req.end();
