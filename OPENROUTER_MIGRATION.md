# OpenRouter Migration Guide

This document explains the migration from OpenAI to OpenRouter for AI-powered summaries.

## What Changed

### Before
- **Provider**: OpenAI API directly
- **Model**: `gpt-5-nano`
- **SDK**: `@ai-sdk/openai` with default OpenAI configuration
- **Environment Variable**: `OPENAI_API_KEY`

### After
- **Provider**: OpenRouter (unified API for 300+ models)
- **Model**: `openai/gpt-oss-20b:free` (free tier with 20B parameters)
- **SDK**: `@ai-sdk/openai` with OpenRouter baseURL configuration
- **Environment Variable**: `OPENROUTER_API_KEY`

## Why OpenRouter?

1. **Cost Savings**: Free tier models with high quality
2. **Reliability**: Automatic provider fallback for higher uptime
3. **Flexibility**: Access to 300+ models through one API
4. **No Vendor Lock-in**: Easy to switch between models

## Setup Instructions

### 1. Get OpenRouter API Key

1. Visit https://openrouter.ai/settings/keys
2. Create a new API key
3. Copy the key (starts with `sk-or-v1-...`)

### 2. Update Environment Variables

Create or update your `.env.local` file:

```bash
# Required: OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here

# Required: Site URL (for OpenRouter attribution & rankings)
NEXT_PUBLIC_SITE_URL=https://13ft.com

# Existing variables (keep these)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
DIFFBOT_TOKEN=your-diffbot-token
```

**Note**: Remove `OPENAI_API_KEY` if it exists - it's no longer needed.

### 3. No Package Changes Needed

The migration uses the existing `@ai-sdk/openai` package with a custom baseURL configuration. No new packages need to be installed.

## Code Changes Summary

### app/api/summary/route.ts

**Before:**
```typescript
import { openai } from '@ai-sdk/openai';

const result = streamText({
  model: openai("gpt-5-nano"),
  // ...
});
```

**After:**
```typescript
import { createOpenAI } from '@ai-sdk/openai';

// Configure OpenRouter provider
const openrouter = createOpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY!,
  headers: {
    'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://13ft.com',
    'X-Title': '13ft - Paywall Bypass & AI Summaries',
  },
});

const result = streamText({
  model: openrouter("openai/gpt-oss-20b:free"),
  // ...
});
```

## Model Information

### Current Model: openai/gpt-oss-20b:free

- **Parameters**: 20 billion
- **Context Length**: 8,192 tokens
- **Cost**: Free tier
- **Provider**: Multiple (OpenRouter auto-routes)
- **Capabilities**: Text generation, instruction following
- **Rate Limits**: Limited for free tier (see OpenRouter docs)

### Alternative Free Models

If you want to change the model, here are other high-quality free options:

```typescript
// Faster, smaller model (good for quick summaries)
model: openrouter("meta-llama/llama-3.2-3b-instruct:free")

// Larger, more capable model
model: openrouter("google/gemma-2-9b-it:free")

// Strong reasoning model
model: openrouter("qwen/qwen-2.5-7b-instruct:free")
```

Browse all models at: https://openrouter.ai/models?max_price=0

## Adding Model Fallback (Advanced)

OpenRouter has built-in provider fallback, but if you want model-level fallback, you can implement it manually:

```typescript
// Option 1: Try-catch with fallback
let result;
try {
  result = streamText({
    model: openrouter("openai/gpt-oss-20b:free"),
    // ...
  });
} catch (error) {
  logger.warn('Primary model failed, trying fallback');
  result = streamText({
    model: openrouter("meta-llama/llama-3.2-3b-instruct:free"),
    // ...
  });
}
```

## OpenRouter Features You Can Use

### 1. Provider Routing

Control which providers serve your requests:

```typescript
const result = streamText({
  model: openrouter.chat("openai/gpt-oss-20b:free"),
  // ... other params
});

// OpenRouter will automatically route to the best available provider
```

### 2. Rate Limits

Free models have rate limits:
- **Without credits**: 100 requests/day
- **With purchased credits**: 200 requests/day

Monitor your usage at: https://openrouter.ai/activity

### 3. Analytics & Monitoring

Your app will appear in OpenRouter rankings due to the attribution headers:
- View at: https://openrouter.ai/rankings
- Track usage: https://openrouter.ai/activity

## Troubleshooting

### Error: "Unauthorized" or "Invalid API Key"

- Verify `OPENROUTER_API_KEY` is set correctly in `.env.local`
- Ensure the key starts with `sk-or-v1-`
- Check that the key hasn't been deleted at https://openrouter.ai/settings/keys

### Error: "Rate limit exceeded"

- Free models have daily limits (100-200 requests/day)
- Add credits to your OpenRouter account for higher limits
- Or switch to a different free model

### Error: "Model not found"

- Verify the model ID is correct: `openai/gpt-oss-20b:free`
- Check model availability at: https://openrouter.ai/models
- The `:free` suffix is important for free tier access

### Summary quality decreased

- The `openai/gpt-oss-20b:free` model is optimized for general use
- Try other models if quality isn't satisfactory:
  - `google/gemma-2-9b-it:free` - Better instruction following
  - `qwen/qwen-2.5-7b-instruct:free` - Strong reasoning

## Testing the Migration

### 1. Local Testing

```bash
# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your OPENROUTER_API_KEY

# Start development server
pnpm dev

# Visit http://localhost:3000
# Enter an article URL and generate a summary
```

### 2. Verify OpenRouter Integration

Check the server logs for:
```
Summary generated { length: 456, inputTokens: 1234, outputTokens: 123, totalTokens: 1357 }
```

### 3. Monitor OpenRouter Dashboard

Visit https://openrouter.ai/activity to see:
- Request count
- Token usage
- Cost (should be $0.00 for free models)
- Response times

## Rollback Plan

If you need to revert to OpenAI:

### 1. Revert Code Changes

```typescript
// In app/api/summary/route.ts
import { openai } from '@ai-sdk/openai';

// Remove openrouter configuration
// Change model back to:
const result = streamText({
  model: openai("gpt-5-nano"), // or your preferred OpenAI model
  // ...
});
```

### 2. Update Environment

```bash
# Add back to .env.local
OPENAI_API_KEY=your-openai-key

# Remove
# OPENROUTER_API_KEY=...
```

## Additional Resources

- **OpenRouter Documentation**: https://openrouter.ai/docs
- **OpenRouter Models**: https://openrouter.ai/models
- **API Reference**: https://openrouter.ai/docs/api-reference
- **Rate Limits**: https://openrouter.ai/docs/api-reference/limits
- **Support**: https://discord.gg/openrouter

## Benefits of This Migration

1. **Zero Cost**: Free tier model with 20B parameters
2. **Better Uptime**: OpenRouter automatically routes around provider outages
3. **Future Flexibility**: Easy to switch to paid models or try new models
4. **Unified Billing**: If you expand to multiple models, one bill from OpenRouter
5. **Community Rankings**: Your app appears in OpenRouter's public rankings

## Next Steps

After successful migration, consider:

1. **Monitor Usage**: Check https://openrouter.ai/activity regularly
2. **Experiment with Models**: Try different free models to optimize quality/speed
3. **Add Fallback**: Implement model-level fallback if needed
4. **Upgrade if Needed**: Add credits for higher rate limits or paid models

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review OpenRouter docs: https://openrouter.ai/docs
3. Join OpenRouter Discord: https://discord.gg/openrouter
4. Create an issue in this repository

