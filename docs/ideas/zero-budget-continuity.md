# ChadGPT Zero-Budget Continuity

## Problem Statement
How might we keep ChadGPT running 24/7 for 100–500 req/day with no ongoing API cost?

## Recommended Direction

Build a `CascadeProvider` that tries providers in order:
1. **Paid Gemini** (primary, best quality)
2. **Free Gemini pool** (2–3 keys from separate Google accounts, 1,500 req/day each)
3. **Groq free tier** (llama-3.3-70b-versatile, 14,400 req/day, OpenAI-compat API)

Each tier catches `429` (rate limit / quota exceeded) from the tier above and falls through. Non-quota errors bubble up immediately. If all tiers fail, the route handler returns a friendly Thai error message.

Effective capacity: ~18,000+ req/day at zero additional cost.

## Key Assumptions to Validate

- [ ] Multiple Gemini free keys from different accounts won't get flagged — keep to 2–3 max, use genuine dev accounts
- [ ] Groq llama-3.3-70b quality is acceptable for this use case — test with actual prompts before production
- [ ] `OpenAIProvider` works with Groq's baseURL — both speak OpenAI spec, should be drop-in

## MVP Scope

1. Extend `OpenAIProvider` to accept optional `baseURL` and `model` (enables Groq as a drop-in)
2. Create `CascadeProvider` implementing `LLMProvider` — tries providers in order, cascades on 429
3. Update `createProvider()` to accept `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3`, `GROQ_API_KEY`
4. Update `vercel.ts` adapter to pass the new env vars
5. Document the new env vars in `.env.example`

## Not Doing (and Why)

- **Semantic response cache** — good idea, Phase 2 after cascade is proven stable
- **Quota-aware router** — overkill at 100–500 req/day across multiple keys
- **Cloudflare Workers AI** — adds dependency; Groq quality is meaningfully better on llama-3.3-70b
- **Self-hosted models** — no infra budget, defeats the purpose

## Open Questions

- Should cascade order be fixed (deterministic) or shuffle for load spread? → Fixed for now (predictable debugging)
- Does Groq free tier need a credit card? → No, email signup only at console.groq.com
