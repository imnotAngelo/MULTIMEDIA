/**
 * Creates the `messages` table in Supabase via the Management API.
 *
 * Usage:
 *   1. Go to: https://app.supabase.com/account/tokens
 *   2. Generate a personal access token, copy it
 *   3. Run: node create-messages-table.mjs YOUR_TOKEN_HERE
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
  console.error('Steps:');
  console.error('  1. Go to: https://app.supabase.com/account/tokens');
  console.error('  2. Click "Generate new token" and copy it');
  console.error('  3. Run: node create-messages-table.mjs YOUR_TOKEN_HERE\n');
  process.exit(1);
}

const sql = fs.readFileSync(
  path.join(__dirname, 'create-messages-table.sql'),
  'utf8'
);

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
      console.log('\n✅ SUCCESS! `messages` table is ready.\n');
    } else if (res.statusCode === 401) {
      console.error('\n❌ Unauthorized (401). Check your access token.\n');
    } else {
      console.error(`\n❌ Failed (HTTP ${res.statusCode}):`);
      console.error(data);
    }
  });
});

req.on('error', (err) => {
  console.error('❌ Request error:', err.message);
});

req.write(body);
req.end();
