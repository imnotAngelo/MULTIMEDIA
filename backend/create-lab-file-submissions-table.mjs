/**
 * Creates the `lab_file_submissions` table in Supabase.
 *
 * Run ONCE before starting the backend:
 *   node create-lab-file-submissions-table.mjs YOUR_SUPABASE_TOKEN
 *
 * Get a token at: https://app.supabase.com/account/tokens
 */

import https from 'https';

const PROJECT_REF = 'ciopmrwvmgqsbapyljih';
const token = process.argv[2];

if (!token) {
  console.error('\n❌ Missing access token!\n');
  console.error('Usage:  node create-lab-file-submissions-table.mjs YOUR_TOKEN\n');
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS lab_file_submissions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_id        TEXT         NOT NULL,
  lab_title     TEXT,
  student_id    UUID         NOT NULL,
  file_name     TEXT         NOT NULL,
  file_path     TEXT         NOT NULL,
  file_size     INTEGER,
  file_type     TEXT,
  note          TEXT,
  submitted_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_file_sub_student  ON lab_file_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_lab_file_sub_lab      ON lab_file_submissions(lab_id);
CREATE UNIQUE INDEX IF NOT EXISTS uix_lab_file_sub_lab_student
  ON lab_file_submissions(lab_id, student_id);

ALTER TABLE lab_file_submissions DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
`;

const body = JSON.stringify({ query: sql });
const options = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${PROJECT_REF}/database/query`,
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  },
};

console.log('🔌 Connecting to Supabase Management API...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => (data += chunk));
  res.on('end', () => {
    if (res.statusCode === 200 || res.statusCode === 201) {
      console.log('\n✅ SUCCESS! Table `lab_file_submissions` is ready.');
      console.log('   Restart your backend and the upload endpoint will work.\n');
    } else if (res.statusCode === 401) {
      console.error('\n❌ Unauthorized — token is invalid or expired.\n');
    } else {
      console.error(`\n❌ Unexpected status ${res.statusCode}:`);
      try {
        console.error(JSON.stringify(JSON.parse(data), null, 2));
      } catch {
        console.error(data);
      }
    }
  });
});

req.on('error', (err) => console.error('❌ Request error:', err.message));
req.write(body);
req.end();
