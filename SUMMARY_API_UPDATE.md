# Summary API Update - Content-Based Summarization

## Overview
Updated the summary feature to use already-fetched article content instead of re-fetching, with automatic selection of the longest/best source.

## Key Changes

### 1. **API Route Updated**
**File**: `/app/api/summary/route.ts`

**Before**: API fetched content from URL
```typescript
POST /api/summary
{
  "url": "https://example.com",
  "language": "en"
}
```

**After**: API receives content directly
```typescript
POST /api/summary
{
  "content": "Article text content...",
  "title": "Article Title",
  "url": "https://example.com",  // optional, for cache key
  "language": "en"
}
```

**Benefits**:
- ✅ No duplicate fetching
- ✅ Uses already-parsed article content
- ✅ Faster response times
- ✅ Uses the same content user is reading

### 2. **Smart Source Selection**
**File**: `/components/summary-form.tsx`

**Features**:
- 🎯 Automatically selects source with longest content
- ⭐ Shows star (⭐) next to best source
- 📊 Displays character counts for each source
- 🔄 Updates selection when article data loads

**Example UI**:
```
Choose Source:
[ Direct (5,234 chars) ⭐ ]
[ Wayback (3,456 chars) ]
[ Jina.ai (4,123 chars) ]
```

### 3. **Architecture Refactor**
**New File**: `/components/proxy-content.tsx`

**Data Flow**:
```
ProxyContent (fetches with useArticles)
  ├─ SummaryForm (receives article data)
  └─ ArrowTabs (receives article data)
```

**Before**:
```
ArrowTabs (fetched with useArticles)
SummaryForm (separate, no article data)
```

**After**:
```
ProxyContent (fetches once)
  ├─ SummaryForm (uses article data)
  └─ ArrowTabs (uses article data)
```

## How It Works

### 1. Article Data Fetching
When user visits `/proxy?url=...`:
1. `ProxyContent` component uses `useArticles()` hook
2. Fetches all 3 sources in parallel (direct, wayback, jina.ai)
3. Passes results to both `SummaryForm` and `ArrowTabs`

### 2. Automatic Source Selection
```typescript
// Find longest source
const longestSource = useMemo(() => {
  const sources = [
    { source: "direct", length: directData?.textContent?.length || 0 },
    { source: "wayback", length: waybackData?.textContent?.length || 0 },
    { source: "jina.ai", length: jinaiData?.textContent?.length || 0 },
  ];
  sources.sort((a, b) => b.length - a.length);
  return sources[0].source;
}, [articleResults]);
```

### 3. Summary Generation
When user clicks "Generate Summary":
1. Takes content from selected source
2. Sends to API with title, url, language
3. API generates summary with OpenAI
4. Displays result

## Benefits

### Performance
- ✅ **No duplicate fetches**: Uses already-loaded content
- ✅ **Faster**: No waiting for content fetch
- ✅ **Efficient**: Single API call for all sources

### User Experience
- ✅ **Smart defaults**: Auto-selects best source
- ✅ **Transparency**: Shows content lengths
- ✅ **Visual feedback**: Star indicator for best source
- ✅ **Manual override**: User can select different source

### Developer Experience
- ✅ **Single source of truth**: One fetch, multiple uses
- ✅ **Type-safe**: Full TypeScript support
- ✅ **Maintainable**: Clear data flow
- ✅ **Testable**: Easy to mock article data

## Example Flow

### Complete User Journey

1. **User visits**: `http://localhost:3000/proxy?url=https://nytimes.com/article`

2. **ProxyContent loads**:
   - Fetches from all 3 sources in parallel
   - Direct: 5,234 chars
   - Wayback: 6,789 chars ⭐ (longest)
   - Jina.ai: 4,123 chars

3. **SummaryForm initializes**:
   - Auto-selects "Wayback" (longest)
   - Shows dropdown with character counts
   - Ready to generate summary

4. **User clicks "Generate Summary"**:
   ```json
   POST /api/summary
   {
     "content": "Full article text from Wayback source...",
     "title": "Article Title",
     "url": "https://nytimes.com/article",
     "language": "en"
   }
   ```

5. **API processes**:
   - Checks rate limits
   - Checks cache
   - Generates summary with OpenAI
   - Returns result

6. **User sees summary**:
   - Blue box with summary text
   - Can change language and regenerate
   - Can try different source

## Source Selection Logic

### Automatic Selection
```typescript
Direct:  5,234 chars
Wayback: 6,789 chars ⭐ (SELECTED - longest)
Jina.ai: 4,123 chars
```

### Why Longest?
Longest content typically means:
- ✅ Most complete article
- ✅ Best parsing quality
- ✅ More context for AI
- ✅ Better summaries

### Manual Override
User can still select any source if they prefer a different one.

## API Changes

### Request Schema
```typescript
{
  content: string;    // Required: Article content
  title?: string;     // Optional: Article title
  url?: string;       // Optional: For cache key
  ip?: string;        // Optional: For rate limiting
  language?: string;  // Optional: Default "en"
}
```

### Response Schema
```typescript
{
  summary: string;    // Generated summary
  cached?: boolean;   // True if from cache
}
```

### Error Response
```typescript
{
  error: string;      // Error message
}
```

## Caching Strategy

### Cache Key Generation
```typescript
// If URL provided
`summary:${language}:${url}`

// If no URL (uses content hash)
`summary:${language}:${contentHash}`
```

### Example Cache Keys
```
summary:en:https://nytimes.com/article
summary:es:https://nytimes.com/article
summary:en:aGVsbG8gd29ybGQ=  // content hash
```

## Dev Logging

### Example Console Output
```
🔄 Summary Request: {
  contentLength: 6789,
  title: "Breaking News Article",
  language: "en"
}
📍 Client IP: 192.168.1.1
🌐 Language: en
📝 Content length: 6789 chars
📝 Generating summary for Breaking News Article...
✅ Summary generated (234 chars)
```

## Testing

### Test Different Sources
1. Visit article page
2. Open summary drawer
3. Check which source is auto-selected (⭐)
4. Try generating summary
5. Change to different source
6. Generate again - should work with that source's content

### Test Language Selection
1. Generate summary in English
2. Change language to Spanish
3. Generate again - should get Spanish summary
4. Both cached separately

### Test Content Lengths
1. Look at dropdown - shows character counts
2. Source with most characters has ⭐
3. Can manually select shorter source if desired

## Migration Notes

### Files Changed
- ✅ `/app/api/summary/route.ts` - accepts content instead of URL
- ✅ `/components/summary-form.tsx` - smart source selection
- ✅ `/components/proxy-content.tsx` - new wrapper component
- ✅ `/components/arrow-tabs.tsx` - receives article data as props
- ✅ `/app/proxy/page.tsx` - uses ProxyContent wrapper
- ✅ `/types/api.ts` - updated request schema

### Breaking Changes
None for end users. Internal API contract changed but everything is handled internally.

### Backward Compatibility
Old server action code has been completely replaced. No rollback path needed as new approach is strictly better.

## Future Enhancements

### Possible Improvements
1. **Summary comparison**: Show summaries from all sources side-by-side
2. **Quality indicator**: Score each source's content quality
3. **Custom length**: Let user choose summary length (short/medium/long)
4. **Bullet points**: Option for bullet-point format
5. **Key quotes**: Extract important quotes from article
6. **Topics**: Auto-detect and display article topics

## Conclusion

This update provides:
- ✅ More efficient architecture
- ✅ Better user experience
- ✅ Smarter defaults
- ✅ Clearer data flow
- ✅ No duplicate fetching
- ✅ Transparent source selection

The summary feature now intelligently uses the best available content and provides clear feedback to users about their choices!

