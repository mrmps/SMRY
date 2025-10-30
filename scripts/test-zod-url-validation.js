#!/usr/bin/env node

/**
 * Test Zod URL validation to see if it's normalizing URLs incorrectly
 */

const { z } = require('zod');

console.log('=== Zod URL Validation Test ===\n');

const ArticleRequestSchema = z.object({
  url: z.string().url("Invalid URL format"),
  source: z.enum(["smry-fast", "smry-slow", "wayback", "jina.ai"]),
});

const testCases = [
  {
    name: 'Normal HTTPS URL',
    input: {
      url: 'https://blog.csdn.net/asd372506589/article/details/106399868',
      source: 'wayback'
    }
  },
  {
    name: 'URL-encoded URL (from query param)',
    input: {
      url: 'https%3A%2F%2Fblog.csdn.net%2Fasd372506589%2Farticle%2Fdetails%2F106399868',
      source: 'wayback'
    }
  },
  {
    name: 'Decoded URL',
    input: {
      url: decodeURIComponent('https%3A%2F%2Fblog.csdn.net%2Fasd372506589%2Farticle%2Fdetails%2F106399868'),
      source: 'wayback'
    }
  },
  {
    name: 'Malformed URL (single slash)',
    input: {
      url: 'https:/blog.csdn.net/asd372506589/article/details/106399868',
      source: 'wayback'
    }
  }
];

testCases.forEach((testCase, i) => {
  console.log(`Test ${i + 1}: ${testCase.name}`);
  console.log(`Input URL: ${testCase.input.url}`);
  
  try {
    const result = ArticleRequestSchema.safeParse(testCase.input);
    
    if (result.success) {
      console.log('✓ Validation passed');
      console.log(`  Parsed URL: ${result.data.url}`);
      console.log(`  URL changed: ${result.data.url !== testCase.input.url ? 'YES' : 'NO'}`);
      if (result.data.url !== testCase.input.url) {
        console.log(`  Original: ${testCase.input.url}`);
        console.log(`  Modified: ${result.data.url}`);
      }
    } else {
      console.log('✗ Validation failed');
      console.log(`  Error: ${result.error.errors[0].message}`);
    }
  } catch (error) {
    console.log('✗ Exception thrown');
    console.log(`  Error: ${error.message}`);
  }
  
  console.log('');
});

console.log('=== Testing URL constructor behavior ===\n');

const urlStrings = [
  'https://blog.csdn.net/test',
  'https:/blog.csdn.net/test',
  'http://blog.csdn.net/test',
  'http:/blog.csdn.net/test',
];

urlStrings.forEach(urlStr => {
  console.log(`Input:  ${urlStr}`);
  try {
    const parsed = new URL(urlStr);
    console.log(`Output: ${parsed.href}`);
    console.log(`Changed: ${parsed.href !== urlStr ? 'YES' : 'NO'}\n`);
  } catch (error) {
    console.log(`Error: ${error.message}\n`);
  }
});

console.log('=== End Test ===');

