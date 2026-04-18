#!/usr/bin/env node
/**
 * Start script for MULTIMEDIA backend.
 * Prefer compiled dist/server.js, but fall back to TS source when needed.
 */

import('./dist/server.js').catch(async error => {
  console.error('❌ Failed to start server from dist:', error);
  console.log('➡️ Falling back to tsx source start');

  const { spawn } = await import('child_process');
  const proc = spawn('npx', ['tsx', 'src/server.ts'], { stdio: 'inherit' });

  proc.on('exit', code => process.exit(code ?? 1));
});
