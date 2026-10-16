#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

try {
  const input = fs.readFileSync(0, 'utf-8');
  let toolCall = null;
  if (input) {
    try {
      const payload = JSON.parse(input);
      toolCall = payload.toolCall;
    } catch (_) {}
  }

  // Execute TypeScript static verification
  try {
    execSync('npx tsc --noEmit', {
      cwd: projectRoot,
      stdio: 'pipe',
      timeout: 12000,
    });
    // TypeScript check passed cleanly
    console.log(JSON.stringify({}));
  } catch (err) {
    const errorDetails = err.stdout?.toString() || err.stderr?.toString() || err.message;
    console.error(`\n⚠️  [PostToolUse TypeVerifier] TypeScript errors detected:\n${errorDetails}`);
    console.log(JSON.stringify({}));
  }
} catch (e) {
  console.log(JSON.stringify({}));
}
