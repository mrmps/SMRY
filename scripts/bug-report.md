# Bug Report: URL Slash Being Lost

## Issue
URL `https://blog.csdn.net/asd372506589/article/details/106399868` is being mangled to `https:/blog.csdn.net/asd372506589/article/details/106399868` (missing one slash after `https:`).

## Root Cause
**File:** `app/[...slug]/page.tsx`, line 21

```javascript
const formattedSlug = pathname.includes('http:/') || pathname.includes('https:/') 
  ? pathname.slice(1) 
  : `https://${slug}`;
```

### What's Happening:
1. User visits: `smry.ai/https://blog.csdn.net/...`
2. Next.js path normalization collapses consecutive slashes: `/https://blog...` → `/https:/blog...`
3. The code detects the pattern `https:/` (single slash)
4. It removes the leading `/` but preserves the malformed URL: `https:/blog...`
5. This malformed URL is then passed to the `/proxy` page and eventually to the API

## Evidence from Logs
```json
{
  "smryUrl": "https://smry.ai/https:/blog.csdn.net/asd372506589/article/details/106399868?source=wayback",
  "urlWithSource": "https://web.archive.org/web/2/https%3A%2Fblog.csdn.net%2Fasd372506589%2Farticle%2Fdetails%2F106399868"
}
```

Notice: 
- `smryUrl` has `https:/blog...` (malformed, single slash)
- `urlWithSource` has properly encoded URL with `https://` (double slash)

This confirms the URL is being fixed somewhere (likely by JavaScript's URL constructor), but it enters the system malformed.

## Solution

### Option 1: Fix the protocol reconstruction (Recommended)
Replace line 21 in `app/[...slug]/page.tsx`:

```javascript
// OLD (buggy):
const formattedSlug = pathname.includes('http:/') || pathname.includes('https:/') 
  ? pathname.slice(1) 
  : `https://${slug}`;

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

### Option 2: Simpler regex approach
```javascript
let formattedSlug = pathname.slice(1);
// Fix any http:/ or https:/ that doesn't have double slash
formattedSlug = formattedSlug.replace(/^(https?):\/([^/])/, '$1://$2');
// Add https:// if no protocol exists
if (!formattedSlug.match(/^https?:\/\//)) {
  formattedSlug = `https://${formattedSlug}`;
}
```

## Testing
Run `scripts/demonstrate-fix.js` to see the bug and fix in action:

```bash
node scripts/demonstrate-fix.js
```

## Files Created for Analysis
1. `scripts/debug-url-issue.js` - Initial URL debug analysis
2. `scripts/test-zod-url-validation.js` - Tests Zod validation behavior
3. `scripts/trace-url-flow.js` - Traces URL through the system
4. `scripts/analyze-actual-url.js` - Analyzes the malformed URL
5. `scripts/demonstrate-fix.js` - Shows bug and demonstrates fix
6. `scripts/bug-report.md` - This comprehensive report

## Impact
- **Severity:** High
- **Frequency:** Affects all URLs accessed via slug routing (e.g., `smry.ai/https://...`)
- **Workaround:** Use query param format instead: `smry.ai/proxy?url=https://...`
- **Fix Complexity:** Low (single line change with proper validation)

## Verification After Fix
After applying the fix, test with:
```bash
# Visit these URLs and verify they work:
# https://smry.ai/https://blog.csdn.net/asd372506589/article/details/106399868
# https://smry.ai/http://example.com/article
# https://smry.ai/example.com/article
```

Check logs to confirm `smryUrl` shows proper double slashes:
```
"smryUrl": "https://smry.ai/https://blog.csdn.net/..."  ✓ Correct
```

