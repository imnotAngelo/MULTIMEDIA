#!/usr/bin/env node
/**
 * Start script for MULTIMEDIA backend
 * Simply imports and runs the server directly
 */

import('./dist/server.js').catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});
