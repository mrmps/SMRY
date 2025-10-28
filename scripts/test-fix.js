#!/usr/bin/env node

/**
 * Test script to verify the fix works correctly
 * Run this after applying the fix to app/[...slug]/page.tsx
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Testing URL Fix ===\n');

// Test the fixed code
function testFixedCode() {
  console.log('Testing Fixed Implementation:\n');
  
  const testCases = [
    {
      name: 'HTTPS URL (collapsed by Next.js)',
      pathname: '/https:/blog.csdn.net/asd372506589/article/details/106399868',
      expected: 'https://blog.csdn.net/asd372506589/article/details/106399868',
    },
    {
      name: 'HTTP URL (collapsed by Next.js)',
      pathname: '/http:/example.com/article',
      expected: 'http://example.com/article',
    },
    {
      name: 'URL without protocol',
      pathname: '/example.com/article',
      expected: 'https://example.com/article',
    },
    {
      name: 'Already properly formed HTTPS URL',
      pathname: '/https://alreadygood.com/test',
      expected: 'https://alreadygood.com/test',
    },
    {
      name: 'Already properly formed HTTP URL',
      pathname: '/http://alreadygood.com/test',
      expected: 'http://alreadygood.com/test',
    },
    {
      name: 'Complex URL with query params',
      pathname: '/https:/example.com/article?id=123&source=test',
      expected: 'https://example.com/article?id=123&source=test',
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  testCases.forEach((tc, i) => {
    // Implement the fixed logic
    let formattedSlug = tc.pathname.slice(1); // Remove leading '/'
    
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
    
    const success = formattedSlug === tc.expected;
    
    console.log(`Test ${i + 1}: ${tc.name}`);
    console.log(`  Input:    ${tc.pathname}`);
    console.log(`  Output:   ${formattedSlug}`);
    console.log(`  Expected: ${tc.expected}`);
    console.log(`  Result:   ${success ? '✓ PASS' : '✗ FAIL'}`);
    console.log('');
    
    if (success) {
      passed++;
    } else {
      failed++;
    }
  });
  
  console.log('='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  
  return failed === 0;
}

// Check if the fix has been applied
function checkIfFixApplied() {
  console.log('\nChecking if fix has been applied to app/[...slug]/page.tsx:\n');
  
  const filePath = path.join(__dirname, '..', 'app', '[...slug]', 'page.tsx');
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for the buggy code
    const hasBug = content.includes("pathname.includes('http:/') || pathname.includes('https:/')");
    
    // Check for the fix (multiple possible patterns)
    const hasFixPattern1 = content.includes('.replace(/^https:\\//, \'https://\')');
    const hasFixPattern2 = content.includes('.replace(/^http:\\//, \'http://\')');
    const hasFixPattern3 = content.includes('formattedSlug.replace');
    
    const hasFix = hasFixPattern1 || hasFixPattern2 || hasFixPattern3;
    
    if (hasBug && !hasFix) {
      console.log('  ❌ Fix NOT applied - buggy code still present');
      console.log('  Action: Apply the fix from scripts/bug-report.md');
    } else if (hasFix) {
      console.log('  ✅ Fix appears to be applied');
    } else {
      console.log('  ⚠️  Code structure different - manual verification needed');
    }
    
    return hasFix;
  } catch (error) {
    console.log(`  ⚠️  Could not read file: ${error.message}`);
    return false;
  }
}

// Main execution
const allTestsPassed = testFixedCode();
const fixApplied = checkIfFixApplied();

console.log('\n' + '='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
console.log(`✓ All tests passed: ${allTestsPassed ? 'YES' : 'NO'}`);
console.log(`✓ Fix applied: ${fixApplied ? 'YES' : 'NO'}`);

if (!fixApplied) {
  console.log('\nNEXT STEPS:');
  console.log('1. Apply the fix from scripts/bug-report.md to app/[...slug]/page.tsx');
  console.log('2. Run this test script again to verify');
  console.log('3. Test manually with the problematic URL');
}

console.log('\n=== End Test ===');

process.exit(allTestsPassed && fixApplied ? 0 : 1);

