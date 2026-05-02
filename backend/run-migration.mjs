/**
 * Generic SQL migration runner.
 *
 * Connects DIRECTLY to the Supabase Postgres database using DATABASE_URL
 * from .env — no Personal Access Token needed, never expires (unless you
 * rotate your DB password).
 *
 * One-time setup:
 *   1. Supabase Dashboard → Project Settings → Database → Connection string
 *   2. Pick "Transaction pooler" (port 6543) or "Session" (5432)
 *   3. Copy the URI, replace [YOUR-PASSWORD] with your real DB password
 *   4. Add to backend/.env:
 *        DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
 *
 * Usage:
 *   node run-migration.mjs <path-to-sql-file>
 *   node run-migration.mjs create-messages-table.sql
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error('\n❌ Usage: node run-migration.mjs <sql-file>\n');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('\n❌ DATABASE_URL is not set in backend/.env\n');
  console.error('Get it from: Supabase Dashboard → Project Settings → Database → Connection string');
  console.error('Then add this line to backend/.env:');
  console.error('  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres\n');
  process.exit(1);
}

const sqlPath = path.isAbsolute(sqlFile) ? sqlFile : path.join(__dirname, sqlFile);
if (!fs.existsSync(sqlPath)) {
  console.error(`\n❌ SQL file not found: ${sqlPath}\n`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf8');

console.log(`🔌 Connecting to Supabase Postgres...`);
console.log(`📄 Running: ${path.basename(sqlPath)}\n`);

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`✅ SUCCESS! Migration ${path.basename(sqlPath)} applied.\n`);
} catch (err) {
  console.error(`\n❌ Migration failed:`);
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
