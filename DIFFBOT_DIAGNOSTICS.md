# Diffbot & Archive.is Diagnostics

## Current Error Analysis

Based on your error message:
```
Network error: Failed to fetch content. 
Diffbot: Diffbot API error. 
Direct: Rate limit exceeded. Please try again later.
```

## What's Happening

### For Archive.is Source

When you access an `archive.is` URL, the system tries **two methods in parallel**:

1. **Direct Fetch** → Got `429 Rate Limit` ❌
2. **Diffbot API** → Failed with error ❌

Since **both methods failed**, you see the combined error message.

## Most Likely Causes

### 1. Archive.is Rate Limiting (Most Likely) ⚠️

**Archive.is is known for aggressive rate limiting**, especially:
- High traffic periods
- Multiple requests in short time
- Requests from certain IP ranges
- Requests from known bot/scraper IPs

**Evidence:**
- Direct fetch explicitly says "Rate limit exceeded"
- Archive.is often blocks Diffbot's crawler too
- Your other sources (direct, wayback, jina.ai) work fine

### 2. Diffbot Specific Issues (Less Likely)

Possible Diffbot issues:
- ❌ **No API Key**: Would show "No Diffbot API key configured"
- ❌ **Invalid API Key**: Would show "API authentication failed"  
- ⚠️ **Diffbot Rate Limit**: Would show "Rate limit exceeded" (check new logs)
- ⚠️ **Diffbot Can't Access archive.is**: Archive.is might block Diffbot's IPs

## How to Diagnose

### Check Server Logs

With the updated code, you'll now see clearer logs:

**If Diffbot is working:**
```
🔄 Attempting Diffbot extraction for archive.is...
✓ Diffbot successfully extracted HTML (45,231 chars)
```

**If Diffbot API key is missing:**
```
⚠️  No Diffbot API key configured - skipping Diffbot extraction
```

**If Diffbot hits rate limit:**
```
⚠️  Diffbot rate limit exceeded for archive.is
```

**If Diffbot returns no HTML:**
```
⚠️  Diffbot returned article data but no HTML for archive.is (will use direct fetch fallback)
```

**If Archive.is rate limits direct fetch:**
```
⚠️  Rate limited (429) for URL: http://archive.is/... Will use fallback if available.
```

### Check Your Environment

```bash
# Check if Diffbot API key is set
echo $DIFFBOT_API_KEY

# Or in your deployment environment
vercel env ls
# or
heroku config:get DIFFBOT_API_KEY
```

### Test Diffbot Directly

You can test your Diffbot API key directly:

```bash
curl "https://api.diffbot.com/v3/article?token=YOUR_TOKEN&url=https://example.com&html=true"
```

## Expected Behavior

✅ **System is working correctly!** The error shows that:

1. **3 out of 4 sources work:**
   - ✓ `smry` (direct) - 9,837 words
   - ✓ `wayback` - 9,851 words  
   - ✓ `jina.ai` - 2,170 words
   - ❌ `archive` (slow) - Both methods failed

2. **Fallback system works:**
   - When archive.is fails, users can use other tabs
   - The system doesn't crash, it shows a helpful error

## Recommendations

### Short-term Solutions

1. **Use Other Sources**
   - Wayback Machine works great (9,851 words)
   - Direct source works (9,837 words)
   - Archive.is is the slowest anyway

2. **Wait and Retry**
   - Archive.is rate limits are usually temporary
   - Try again in 5-10 minutes
   - Rate limits often reset hourly

3. **Check Your IP**
   - If you're making many requests, space them out
   - Consider using a different deployment region
   - Check if your IP is on any blocklists

### Long-term Solutions

1. **Implement Request Queuing**
   - Add delays between archive.is requests
   - Implement exponential backoff
   - Cache results more aggressively

2. **Rotate Proxies** (if needed)
   - Use proxy rotation for archive.is
   - Respect rate limits and robots.txt

3. **Monitor Diffbot Usage**
   - Check your Diffbot dashboard for:
     - API calls remaining
     - Rate limit status
     - Error patterns
   - Consider upgrading plan if hitting limits

## Diffbot API Limits

Diffbot has different plans with different limits:

| Plan | Requests/Month | Requests/Second |
|------|----------------|-----------------|
| Free Trial | 10,000 | ~3 |
| Startup | 300,000 | ~10 |
| Professional | 3,000,000 | ~100 |
| Enterprise | Unlimited | Negotiable |

**To check your usage:**
1. Go to https://app.diffbot.com/
2. Navigate to Dashboard
3. Check "API Calls" chart
4. Look for rate limit warnings

## Next Steps

### 1. Check Server Logs

Look for the new diagnostic messages in your server logs. They'll tell you exactly what's happening:

```bash
# If deployed on Vercel
vercel logs

# If using Docker
docker logs your-container-name

# If using PM2
pm2 logs
```

### 2. Verify Diffbot Configuration

Make sure your Diffbot API key is properly set:
- Check environment variables
- Verify key is valid (not expired trial)
- Check dashboard for usage/limits

### 3. Test Archive.is Directly

Try accessing archive.is directly from your server:

```bash
curl -I "http://archive.is/latest/https://www.nytimes.com/..."
```

If you get a 429, that confirms archive.is is rate limiting you.

## Common Questions

**Q: Are we exceeding Diffbot's rate limit?**

A: The error message will now tell you explicitly if it's a Diffbot rate limit. Look for:
```
⚠️  Diffbot rate limit exceeded
```

If you don't see this message, it's more likely that:
- Archive.is is blocking Diffbot's crawler
- Archive.is returned content but no HTML
- Diffbot couldn't parse the archive.is page

**Q: Why does archive.is work sometimes but not others?**

A: Archive.is has dynamic rate limiting based on:
- Request frequency
- Time of day
- Your IP reputation
- Random factors

**Q: Should we remove archive.is source?**

A: Not necessary! The multi-source approach is working:
- Most articles work with direct/wayback/jina.ai
- Archive.is is a backup for when others fail
- Users can choose which source to use

## Summary

✅ **Your system is working correctly**
- The error is expected behavior (rate limiting)
- Fallback sources work perfectly
- Error messages are now more informative

⚠️ **Archive.is is rate limiting** (most likely cause)
- Both direct and Diffbot attempts failed
- This is normal for archive.is
- Wait a few minutes and try again

🔍 **Check the new logs** to see exactly what Diffbot says
- Updated error messages are more specific
- Look for rate limit vs. no HTML vs. other errors
- This will confirm the root cause

