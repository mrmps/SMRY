#!/usr/bin/env node

/**
 * Demonstrate the fix for the [...slug] route URL issue
 */

console.log('=== Demonstrating the Bug and Fix ===\n');

// Simulating what happens in Next.js
const testCases = [
  {
    description: 'HTTPS URL with double slash (gets normalized by Next.js)',
    pathname: '/https:/blog.csdn.net/asd372506589/article/details/106399868', // Next.js collapses //
  },
  {
    description: 'HTTP URL with double slash (gets normalized by Next.js)',
    pathname: '/http:/example.com/article',
  },
  {
    description: 'Regular path without protocol',
    pathname: '/some/path/to/article',
  },
];

console.log('CURRENT BUGGY CODE:');
console.log('-------------------');
testCases.forEach(tc => {
  const pathname = tc.pathname;
  const slug = pathname.substring(1);
  
  // Current buggy line 21:
  const formattedSlug = pathname.includes('http:/') || pathname.includes('https:/') 
    ? pathname.slice(1) 
    : `https://${slug}`;
  
  console.log(`\nTest: ${tc.description}`);
  console.log(`  Input pathname: ${pathname}`);
  console.log(`  Output formattedSlug: ${formattedSlug}`);
  console.log(`  ❌ Has single slash bug: ${formattedSlug.match(/https?:\/[^/]/) ? 'YES' : 'NO'}`);
});

console.log('\n\n' + '='.repeat(60));
console.log('FIXED CODE:');
console.log('-------------------');
testCases.forEach(tc => {
  const pathname = tc.pathname;
  const slug = pathname.substring(1);
  
  // FIXED version:
  let formattedSlug = pathname.slice(1); // Remove leading '/'
  
  // First, fix malformed protocols (must come BEFORE the no-protocol check)
  if (formattedSlug.startsWith('https:/') && !formattedSlug.startsWith('https://')) {
    // Fix https:/ to https://
    formattedSlug = formattedSlug.replace(/^https:\//, 'https://');
  } else if (formattedSlug.startsWith('http:/') && !formattedSlug.startsWith('http://')) {
    // Fix http:/ to http://
    formattedSlug = formattedSlug.replace(/^http:\//, 'http://');
  } else if (!formattedSlug.startsWith('http://') && !formattedSlug.startsWith('https://')) {
    // If no protocol at all, add https://
    formattedSlug = `https://${formattedSlug}`;
  }
  
  console.log(`\nTest: ${tc.description}`);
  console.log(`  Input pathname: ${pathname}`);
  console.log(`  Output formattedSlug: ${formattedSlug}`);
  console.log(`  ✓ Properly formed: ${formattedSlug.match(/^https?:\/\//) ? 'YES' : (formattedSlug.includes('http') ? 'NO' : 'N/A')}`);
});

console.log('\n\n' + '='.repeat(60));
console.log('RECOMMENDED FIX:');
console.log('-------------------');
console.log(`
Replace line 21 in app/[...slug]/page.tsx:

OLD (buggy):
const formattedSlug = pathname.includes('http:/') || pathname.includes('https:/') 
  ? pathname.slice(1) 
  : \`https://\${slug}\`;

NEW (fixed):
let formattedSlug = pathname.slice(1); // Remove leading '/'
if (!formattedSlug.startsWith('http://') && !formattedSlug.startsWith('https://')) {
  // If no protocol, add https://
  formattedSlug = \`https://\${formattedSlug}\`;
} else if (formattedSlug.startsWith('https:/') && !formattedSlug.startsWith('https://')) {
  // Fix https:/ to https://
  formattedSlug = formattedSlug.replace(/^https:\\//, 'https://');
} else if (formattedSlug.startsWith('http:/') && !formattedSlug.startsWith('http://')) {
  // Fix http:/ to http://
  formattedSlug = formattedSlug.replace(/^http:\\//, 'http://');
}
`);

console.log('\n=== End Demonstration ===');

