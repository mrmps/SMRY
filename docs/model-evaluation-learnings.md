# Model Evaluation Learnings (Jan 2026)

## Models Tested for Premium Summaries

### z-ai/glm-4.7 (via Cerebras)

**Setup:**
- Model ID: `z-ai/glm-4.7` on OpenRouter
- Provider routing: `{ provider: { only: ["Cerebras"] } }`
- Cerebras BYOK integration available

**Findings:**
- GLM-4.7 has built-in "reasoning" that runs before content generation
- Streaming sends `delta.reasoning` chunks first (~400-600 tokens), then `delta.content`
- Requires `max_tokens: 1500+` to complete both reasoning and content (default cuts off during reasoning)
- Direct Cerebras API has high queue times (~1.8s queue_time observed)
- OpenRouter + Cerebras BYOK is actually *faster* than direct Cerebras API (better queue priority)
- `reasoning_effort` parameter not supported for this model

**Latency:**
- Direct Cerebras: 1.3-4.5s (variable due to queue)
- OpenRouter + Cerebras: 0.8-2.0s
- ~1-2s delay before any content appears (reasoning must complete first)

**Verdict:** Too slow for streaming summaries due to reasoning overhead. Users see long delay before text appears.

---

### qwen/qwen3-next-80b-a3b-instruct

**Setup:**
- Model ID: `qwen/qwen3-next-80b-a3b-instruct` on OpenRouter
- Provider: DeepInfra (automatic routing)

**Findings:**
- No reasoning overhead (`reasoning_tokens: 0`)
- Direct content output
- Fast initial latency

**Latency:**
- 0.6-1.3s total response time

**Issue:** Despite fast latency, throughput was slow (tokens/second during streaming).

**Verdict:** Good latency but poor throughput for streaming use case.

---

## Current Production Models

```typescript
const PREMIUM_MODELS = [
  "qwen/qwen3-30b-a3b",
  "google/gemini-3-flash-preview",
];
```

## Key Takeaways

1. **Reasoning models add perceived latency** - Even if inference is fast, extended "thinking" delays first visible content
2. **Queue times vary significantly** - Direct API isn't always faster than proxied requests
3. **BYOK routing** - Use `{ provider: { only: ["ProviderName"] } }` in OpenRouter to force specific provider
4. **Latency vs throughput** - Fast time-to-first-token doesn't guarantee fast streaming throughput
5. **Test streaming specifically** - Non-streaming benchmarks don't reveal streaming UX issues
