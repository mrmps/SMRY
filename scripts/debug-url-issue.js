#!/usr/bin/env node

/**
 * Debug script to identify URL parsing issue with CSDN blog URL
 * 
 * Issue: https://www.smry.ai/proxy?url=https%3A%2F%2Fblog.csdn.net%2Fasd372506589%2Farticle%2Fdetails%2F106399868
 * is producing malformed URL: https:/blog.csdn.net/asd372506589/article/details/106399868
 * (missing one slash after https:)
 */

console.log('=== URL Debug Script ===\n');

// Test cases
const testURL = 'https://blog.csdn.net/asd372506589/article/details/106399868';
const encodedURL = 'https%3A%2F%2Fblog.csdn.net%2Fasd372506589%2Farticle%2Fdetails%2F106399868';

console.log('1. Original URL from proxy page:');
console.log('   ', testURL);
console.log('   Encoded:', encodeURIComponent(testURL));
console.log('');

console.log('2. URL-encoded version (from query param):');
console.log('   ', encodedURL);
console.log('   Decoded:', decodeURIComponent(encodedURL));
console.log('');

console.log('3. Testing URL parsing:');
try {
  const parsed = new URL(testURL);
  console.log('   Protocol:', parsed.protocol);
  console.log('   Hostname:', parsed.hostname);
  console.log('   Pathname:', parsed.pathname);
  console.log('   Full URL:', parsed.href);
} catch (error) {
  console.log('   ERROR:', error.message);
}
console.log('');

console.log('4. Testing Wayback URL construction:');
const source = 'wayback';
const waybackURL = `https://web.archive.org/web/2/${encodeURIComponent(testURL)}`;
console.log('   Wayback URL:', waybackURL);
console.log('');

console.log('5. Checking for URL normalization issues:');
// Check if URL has proper protocol
const hasProperProtocol = testURL.match(/^https?:\/\//);
console.log('   Has proper protocol?', hasProperProtocol ? 'YES' : 'NO');

// Check various URL formats
const variants = [
  testURL,
  testURL.replace('https://', 'https:/'), // Intentionally malformed
  testURL.replace(/^https:\/\//, 'https:/'), // Another variant
];

console.log('\n6. Testing URL variants:');
variants.forEach((variant, i) => {
  console.log(`   Variant ${i + 1}: ${variant}`);
  try {
    const parsed = new URL(variant);
    console.log(`   -> Parsed OK: ${parsed.href}`);
  } catch (error) {
    console.log(`   -> ERROR: ${error.message}`);
  }
});

console.log('\n7. Analyzing smryUrl construction from logs:');
const loggedSmryUrl = 'https://smry.ai/https:/blog.csdn.net/asd372506589/article/details/106399868?source=wayback';
console.log('   Logged URL:', loggedSmryUrl);
console.log('   Issue: Missing slash after "https:"');
console.log('');

console.log('8. Testing URL construction patterns:');
const validatedUrl = testURL;
const validatedSource = 'wayback';

// Pattern 1: Current implementation suspected
const pattern1 = `https://smry.ai/${validatedUrl}${validatedSource !== 'direct' ? `?source=${validatedSource}` : ''}`;
console.log('   Pattern 1 (concatenation):', pattern1);

// Pattern 2: With URL encoding
const pattern2 = `https://smry.ai/${encodeURIComponent(validatedUrl)}${validatedSource !== 'direct' ? `?source=${validatedSource}` : ''}`;
console.log('   Pattern 2 (encoded):', pattern2);

console.log('\n9. Potential root cause:');
console.log('   The URL is being passed through the system but somewhere');
console.log('   it\'s losing a slash. Check:');
console.log('   - URL parameter extraction from query string');
console.log('   - URL validation/normalization');
console.log('   - String manipulation that might strip double slashes');
console.log('   - Regex patterns that might be removing slashes');

console.log('\n10. Recommendation:');
console.log('   The issue is likely in how the URL is being extracted from');
console.log('   the query parameter or how it\'s being validated/normalized.');
console.log('   Check ArticleRequestSchema validation in types/api.ts');

console.log('\n=== End Debug Script ===');

