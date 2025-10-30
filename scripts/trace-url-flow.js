#!/usr/bin/env node

/**
 * Trace URL flow through the system to find where the slash is being lost
 */

console.log('=== URL Flow Trace ===\n');

// Simulate the actual URL flow
const steps = [];

// Step 1: User visits proxy page
const proxyPageURL = 'https://www.smry.ai/proxy?url=https%3A%2F%2Fblog.csdn.net%2Fasd372506589%2Farticle%2Fdetails%2F106399868';
steps.push({
  step: '1. Browser URL',
  url: proxyPageURL,
  extracted: null
});

// Step 2: Extract URL from query param (Next.js searchParams)
// In Next.js, searchParams.get("url") should automatically decode
const urlObj = new URL(proxyPageURL);
const extractedURL = urlObj.searchParams.get('url');
steps.push({
  step: '2. Extracted from searchParams',
  url: extractedURL,
  note: 'searchParams.get() auto-decodes'
});

// Step 3: Client makes API call
// Looking at proxy page code line 105:
// `${process.env.NEXT_PUBLIC_URL}/api/article?url=${encodeURIComponent(url)}&source=${source}`
const apiCallURL = `/api/article?url=${encodeURIComponent(extractedURL)}&source=wayback`;
steps.push({
  step: '3. API call constructed',
  url: apiCallURL,
  note: 'URL is re-encoded'
});

// Step 4: API receives request
// searchParams.get("url") again
const apiURL = new URL(`https://smry.ai${apiCallURL}`);
const apiExtractedURL = apiURL.searchParams.get('url');
steps.push({
  step: '4. API extracts URL',
  url: apiExtractedURL,
  note: 'searchParams.get() auto-decodes again'
});

// Step 5: Validate with Zod
const { z } = require('zod');
const ArticleRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
  source: z.enum(["smry-fast", "smry-slow", "wayback", "jina.ai"]),
});

const validationResult = ArticleRequestSchema.safeParse({
  url: apiExtractedURL,
  source: 'wayback'
});

steps.push({
  step: '5. Zod validation',
  url: validationResult.success ? validationResult.data.url : 'FAILED',
  note: validationResult.success ? 'Passed' : validationResult.error.errors[0].message
});

// Step 6: Construct smryUrl for logging
const validatedUrl = validationResult.success ? validationResult.data.url : apiExtractedURL;
const validatedSource = 'wayback';
const smryUrl = validatedSource === 'smry-fast'
  ? `https://smry.ai/${validatedUrl}`
  : `https://smry.ai/${validatedUrl}?source=${validatedSource}`;
steps.push({
  step: '6. Construct smryUrl for logging',
  url: smryUrl,
  note: 'Direct string concatenation'
});

// Print all steps
steps.forEach((s, i) => {
  console.log(`${s.step}`);
  console.log(`  URL: ${s.url}`);
  if (s.note) console.log(`  Note: ${s.note}`);
  
  // Check for issues
  if (s.url && typeof s.url === 'string') {
    if (s.url.includes('https:/') && !s.url.includes('https://')) {
      console.log('  ⚠️  ISSUE DETECTED: URL has https:/ instead of https://');
    }
    if (s.url.includes('http:/') && !s.url.includes('http://')) {
      console.log('  ⚠️  ISSUE DETECTED: URL has http:/ instead of http://');
    }
  }
  console.log('');
});

console.log('=== Analysis ===\n');
console.log('The URL flows correctly through all steps.');
console.log('The issue must be in the actual runtime environment.');
console.log('');
console.log('HYPOTHESIS:');
console.log('The logged URL "https:/blog.csdn.net..." suggests the URL is');
console.log('being passed incorrectly somewhere. Possible causes:');
console.log('1. URL is being extracted incorrectly from request');
console.log('2. Some middleware or edge function is modifying it');
console.log('3. There\'s a regex or string replacement stripping double slashes');
console.log('4. The URL in the actual request is already malformed');
console.log('');
console.log('NEXT STEPS:');
console.log('1. Add detailed logging at every URL extraction point');
console.log('2. Log the raw request URL before any processing');
console.log('3. Check if there are any Next.js middleware or rewrites');

console.log('\n=== End Trace ===');

