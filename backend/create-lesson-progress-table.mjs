/**
 * Creates the `lesson_progress` table in Supabase.
 *
 * Run ONCE before starting the backend:
 *   node create-lesson-progress-table.mjs YOUR_SUPABASE_TOKEN
 *
 * Get a token at: https://app.supabase.com/account/tokens
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_REF = 'ciopmrwvmgqsbapyljih';
const token = process.argv[2];

if (!token) {
  console.error('\n❌ Missing access token!\n');
  console.error('Usage:  node create-lesson-progress-table.mjs YOUR_TOKEN\n');
  process.exit(1);
}

const sql = fs.readFileSync(path.join(__dirname, 'create-lesson-progress-table.sql'), 'utf8');
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
  let chunks = '';
  res.on('data', (d) => (chunks += d));
  res.on('end', () => {
    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
      console.log('✅ lesson_progress table ready.');
    } else {
      console.error(`❌ HTTP ${res.statusCode}:`, chunks);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('❌ Request error:', e.message);
  process.exit(1);
});

req.write(body);
req.end();
