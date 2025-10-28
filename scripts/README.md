# Scripts Directory - URL Bug Analysis

This directory contains scripts used to debug and fix the URL slash issue in the smry.ai application.

## Issue Summary

**Problem:** URLs like `https://blog.csdn.net/...` are being mangled to `https:/blog.csdn.net/...` (missing one slash after `https:`).

**Root Cause:** The `app/[...slug]/page.tsx` file has buggy logic that doesn't properly handle URLs when Next.js path normalization collapses consecutive slashes.

**Impact:** Affects all URLs accessed via slug routing (e.g., `smry.ai/https://example.com`)

## Scripts Overview

### 1. `debug-url-issue.js`
Initial debugging script that explores URL encoding and construction patterns.

**Run:**
```bash
node scripts/debug-url-issue.js
```

### 2. `test-zod-url-validation.js`
Tests Zod URL validation to determine if validation is causing the issue.

**Run:**
```bash
node scripts/test-zod-url-validation.js
```

**Key Finding:** Zod validation is NOT the issue. URLs are being received already malformed.

### 3. `trace-url-flow.js`
Traces URL flow through the system from browser to API.

**Run:**
```bash
node scripts/trace-url-flow.js
```

### 4. `analyze-actual-url.js`
Analyzes the actual malformed URL from production logs.

**Run:**
```bash
node scripts/analyze-actual-url.js
```

**Key Finding:** URL constructor normalizes `https:/` to `https://`, masking the issue.

### 5. `demonstrate-fix.js`
Demonstrates the bug with the current code and shows how the fix works.

**Run:**
```bash
node scripts/demonstrate-fix.js
```

**Output:** Side-by-side comparison of buggy vs fixed code behavior.

### 6. `test-fix.js` ⭐ **MOST IMPORTANT**
Comprehensive test suite that:
- Tests the fixed implementation with multiple test cases
- Checks if the fix has been applied to the codebase
- Provides next steps if fix is not applied

**Run:**
```bash
node scripts/test-fix.js
```

**Exit Codes:**
- `0`: All tests pass AND fix is applied
- `1`: Tests fail OR fix is not applied

### 7. `bug-report.md` 📄 **DOCUMENTATION**
Comprehensive bug report including:
- Issue description
- Root cause analysis
- Evidence from logs
- Solution with code examples
- Testing instructions
- Impact assessment

**Read:**
```bash
cat scripts/bug-report.md
```

## Quick Start - How to Fix the Bug

1. **Read the bug report:**
   ```bash
   cat scripts/bug-report.md
   ```

2. **Run the test to confirm the issue:**
   ```bash
   node scripts/test-fix.js
   ```

3. **Apply the fix to `app/[...slug]/page.tsx`:**
   
   Replace line 21:
   ```javascript
   // OLD (buggy):
   const formattedSlug = pathname.includes('http:/') || pathname.includes('https:/') 
     ? pathname.slice(1) 
     : `https://${slug}`;
   ```
   
   With:
   ```javascript
   // NEW (fixed):
   let formattedSlug = pathname.slice(1); // Remove leading '/'
   
   // First, fix malformed protocols (must come BEFORE the no-protocol check)
   if (formattedSlug.startsWith('https:/') && !formattedSlug.startsWith('https://')) {
     // Fix https:/ to https://  (Next.js path normalization removes one slash)
     formattedSlug = formattedSlug.replace(/^https:\//, 'https://');
   } else if (formattedSlug.startsWith('http:/') && !formattedSlug.startsWith('http://')) {
     // Fix http:/ to http://
     formattedSlug = formattedSlug.replace(/^http:\//, 'http://');
   } else if (!formattedSlug.startsWith('http://') && !formattedSlug.startsWith('https://')) {
     // If no protocol at all, add https://
     formattedSlug = `https://${formattedSlug}`;
   }
   ```

4. **Verify the fix:**
   ```bash
   node scripts/test-fix.js
   ```
   
   Should output:
   ```
   ✓ All tests passed: YES
   ✓ Fix applied: YES
   ```

5. **Test manually:**
   - Visit: `https://smry.ai/https://blog.csdn.net/asd372506589/article/details/106399868`
   - Check logs to confirm `smryUrl` shows proper double slashes

## Test Cases Covered

The fix handles these scenarios:

1. ✅ HTTPS URL collapsed by Next.js: `/https:/blog.csdn.net/...` → `https://blog.csdn.net/...`
2. ✅ HTTP URL collapsed by Next.js: `/http:/example.com/...` → `http://example.com/...`
3. ✅ URL without protocol: `/example.com/...` → `https://example.com/...`
4. ✅ Already properly formed HTTPS: `/https://good.com/...` → `https://good.com/...`
5. ✅ Already properly formed HTTP: `/http://good.com/...` → `http://good.com/...`
6. ✅ Complex URLs with query params: `/https:/example.com/?id=123` → `https://example.com/?id=123`

## Why Next.js Collapses Double Slashes

When you visit `smry.ai/https://example.com`, the path is `/https://example.com`. Next.js routing normalizes consecutive slashes in paths to prevent issues, so:

```
/https://example.com  →  /https:/example.com
```

This is standard behavior in web frameworks to treat multiple slashes as single path separators. Our fix compensates for this by detecting and repairing the malformed protocol.

## Files Modified

**Analysis Only (this directory):**
- ✅ All scripts in `/scripts` directory
- ❌ NO source code files modified (as per user request)

**To Apply Fix (manual step):**
- 📝 `app/[...slug]/page.tsx` - Line 21 needs to be updated

## Troubleshooting

### If tests fail after applying fix:
1. Ensure you copied the exact code from `bug-report.md`
2. Check that the order of if/else statements is correct (protocol fix BEFORE no-protocol check)
3. Verify no syntax errors were introduced

### If fix is not detected:
1. Make sure you're editing `app/[...slug]/page.tsx`
2. Save the file after editing
3. The fix detection looks for `.replace(/^https:\//, 'https://')` pattern

### If URL still doesn't work after fix:
1. Clear browser cache
2. Restart Next.js dev server
3. Check Next.js version for any routing changes
4. Verify there's no middleware modifying URLs

## Additional Resources

- Original issue URL: `https://www.smry.ai/proxy?url=https%3A%2F%2Fblog.csdn.net%2Fasd372506589%2Farticle%2Fdetails%2F106399868`
- Logs showing the bug in `bug-report.md`
- All test scripts can be run independently for debugging

## Questions?

Refer to `bug-report.md` for the complete analysis and solution documentation.

