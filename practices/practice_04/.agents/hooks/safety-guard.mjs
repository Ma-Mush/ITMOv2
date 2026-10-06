#!/usr/bin/env node
import fs from 'fs';

// Read stdin synchronously
try {
  const input = fs.readFileSync(0, 'utf-8');
  if (!input) {
    console.log(JSON.stringify({ decision: 'allow' }));
    process.exit(0);
  }

  const payload = JSON.parse(input);
  const toolCall = payload.toolCall;

  if (toolCall && toolCall.name === 'run_command') {
    const cmd = (toolCall.args?.CommandLine || '').trim();

    // Dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf\s+[\/\*]/i,
      /rm\s+-rf\s+\.\/?$/i,
      /git\s+clean\s+-fdx/i,
      /mkfs/i,
      /:(){ :|:& };:/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(cmd)) {
        console.log(JSON.stringify({
          decision: 'deny',
          reason: `Blocked potentially destructive command pattern: ${pattern}`
        }));
        process.exit(0);
      }
    }
  }

  console.log(JSON.stringify({ decision: 'allow' }));
} catch (e) {
  // Fallback to allow if parsing error
  console.log(JSON.stringify({ decision: 'allow' }));
}
