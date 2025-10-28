#!/usr/bin/env node

/**
 * Analyze the actual malformed URL from the logs
 */

console.log('=== Analyzing Actual URL from Logs ===\n');

// From the logs, the actual URL being processed is:
const actualURL = 'https:/blog.csdn.net/asd372506589/article/details/106399868';
const expectedURL = 'https://blog.csdn.net/asd372506589/article/details/106399868';

console.log('1. URLs from logs:');
console.log('   Actual URL (malformed):', actualURL);
console.log('   Expected URL:', expectedURL);
console.log('   Missing character:', actualURL.replace('https:/', 'https://') === expectedURL ? 'One slash after colon' : 'Unknown');
console.log('');

console.log('2. Testing URL parsing:');
try {
  const parsed = new URL(actualURL);
  console.log('   ✓ Malformed URL still parses!');
  console.log('   Parsed href:', parsed.href);
  console.log('   Protocol:', parsed.protocol);
  console.log('   Hostname:', parsed.hostname);
  console.log('');
  
  // This is the issue! URL constructor normalizes https:/ to https://
  console.log('   🔍 KEY FINDING:');
  console.log('   The URL constructor automatically fixes https:/ to https://');
  console.log('   So even though the URL comes in malformed, it gets fixed during parsing.');
} catch (error) {
  console.log('   ✗ Failed to parse:', error.message);
}

console.log('\n3. Where could the slash be lost?');
console.log('   Possible locations:');
console.log('   a) The URL slug routing in Next.js (/[...slug]/page.tsx)');
console.log('   b) The proxy page URL extraction');
console.log('   c) Client-side URL manipulation before API call');
console.log('   d) Vercel edge function or rewrite rules');
console.log('');

console.log('4. Checking if this is a [...slug] route issue:');
// The issue: When you visit smry.ai/https://example.com
// Next.js captures the path as a slug
// But Next.js might normalize double slashes in paths!

const testPaths = [
  'https://blog.csdn.net/test',
  'https:/blog.csdn.net/test',
  'http://blog.csdn.net/test',
];

console.log('   Testing path extraction:');
testPaths.forEach(path => {
  // Simulating Next.js [...slug] route capture
  const captured = path; // In Next.js, this would be params.slug.join('/')
  console.log(`   Path: ${path}`);
  console.log(`   Captured: ${captured}`);
  console.log('');
});

console.log('5. LIKELY ROOT CAUSE:');
console.log('   When visiting smry.ai/https://example.com, Next.js might:');
console.log('   - Normalize the path by removing "extra" slashes');
console.log('   - Treat consecutive slashes as a single path separator');
console.log('   - This would turn /https://example.com into /https:/example.com');
console.log('');

console.log('6. VERIFICATION NEEDED:');
console.log('   Check the [...slug]/page.tsx route to see how it captures the URL');
console.log('   The slug params might already have the malformed URL');
console.log('');

console.log('7. SOLUTION:');
console.log('   Looking at the codebase, we should check if there\'s a [...slug] route');
console.log('   that\'s intercepting URLs and potentially mangling them.');
console.log('   The /proxy route should use query params, not slug routing.');

console.log('\n=== End Analysis ===');

