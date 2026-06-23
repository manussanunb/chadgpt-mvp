# Security Implementation Summary

**Date:** 2026-06-16  
**Scope:** ChadGPT MVP (chadgpt-mvp.vercel.app)

---

## Threat Model

| Trust Boundary | Risk |
|---|---|
| `POST /api/chat` — user message input | Injection, abuse |
| LLM response rendered in browser | XSS via malicious markdown links |
| Cloudflare Turnstile verification | Bot bypass |
| PostHog `x-posthog-distinct-id` header | Analytics pollution |
| In-memory rate limiter | Memory exhaustion |

---

## Changes Made

### 1. XSS — LLM Output URL Sanitization
**File:** `components/MessageBubble.tsx`  
**Problem:** `ReactMarkdown` rendered `href` attributes from LLM output verbatim. A `javascript:` or `data:` URI embedded in a model-generated markdown link would execute on click.  
**Fix:** `href` is validated against `/^https?:\/\//` before being passed to `<a>`. Any non-HTTP(S) URL is dropped (`href={undefined}`).

### 2. Security Headers
**File:** `next.config.ts`  
**Problem:** No security headers were set. Missing protections against clickjacking, MIME-sniffing, and cross-origin script injection.  
**Fix:** Added via `headers()` in Next.js config, applied to all routes:

| Header | Value | Protects Against |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | MIME-type sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Browser feature abuse |
| `Content-Security-Policy` | See below | Script/frame injection |

**CSP:**
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
frame-src https://challenges.cloudflare.com;
connect-src 'self' https://us.i.posthog.com https://us-assets.i.posthog.com;
frame-ancestors 'none'
```

**Known limitation:** `'unsafe-eval'` and `'unsafe-inline'` are required because Next.js's webpack runtime uses `new Function()` for dynamic module loading and inline scripts for hydration. The proper fix is a nonce-based CSP via Next.js middleware — deferred as future work.

### 3. Rate Limiter Memory Leak
**File:** `app/api/chat/route.ts`  
**Problem:** The `ipTimestamps` Map accumulated entries indefinitely. IPs that sent one request and never returned would never be evicted.  
**Fix:** A cleanup pass runs every 5 minutes, deleting IPs whose timestamps are all older than the 60-second window.

**Known limitation:** Rate limiting is in-memory and resets on every cold start. Under Vercel's serverless model, concurrent instances each maintain independent state, so the effective limit per IP is `RATE_LIMIT × instance_count`. Acceptable for current traffic; upgrade to Redis/Upstash if abuse becomes a concern.

### 4. `x-posthog-distinct-id` Header Sanitization
**File:** `app/api/chat/route.ts`  
**Problem:** The header value was passed to PostHog unvalidated, allowing an attacker to inject arbitrary strings into analytics.  
**Fix:** Value is truncated to 64 characters and non-word characters are replaced with `_`.

### 5. `form-data` CRLF Injection (GHSA-hmw2-7cc7-3qxx)
**Fix:** `npm audit fix` — dependency updated automatically.

---

## Cloudflare WAF Configuration

**Date configured:** 2026-06-23

### Block Suspicious Bots (Custom Rule)
- **Action:** Managed Challenge
- **Expression:** `(cf.client.bot) and not (cf.verified_bot_category in {"Search Engine Crawlers"})`
- **Note:** `cf.bot_score` is not available on the free plan; this rule uses `cf.client.bot` instead

### Challenge Non-Browser Traffic on Chat Endpoint (Custom Rule)
- **Action:** Managed Challenge
- **Expression:** `(http.request.uri.path eq "/api/chat" and cf.client.bot)`
- **Target:** `/api/chat` exactly (confirmed from `app/api/chat/route.ts` — no trailing slash)

### Bot Fight Mode
- **Setting:** Enabled (Security → Bots → Bot Fight Mode)
- **Effect:** Cloudflare automatically challenges known bots before requests reach the origin

### Rate Limiting Rule
- **Path:** `/api/*`
- **Limit:** 5 requests per 10 seconds per IP
- **Mitigation timeout:** 10 seconds
- **Action:** Block
- **Characteristics:** `ip.src`
- **Configured via:** Cloudflare Ruleset API (`http_ratelimit` phase entrypoint)

---

## What Was Already in Place

| Control | Notes |
|---|---|
| Cloudflare Turnstile | Bot protection; skipped in `NODE_ENV=development` |
| In-app rate limiting | 5 requests / 60 s per IP |
| Message length cap | 500 characters |
| Input type validation | `message` must be a non-empty string |
| No SQL / database | All data is pre-embedded static JSON; no query injection surface |
| HTTPS / HSTS | Provided by Vercel (`max-age=63072000; includeSubDomains; preload`) |
| No `dangerouslySetInnerHTML` | `ReactMarkdown` without `rehypeRaw` — raw HTML in model output is stripped |
| Secrets in env only | `.env.local` in `.gitignore`; `.env.example` contains only placeholders |
| Generic error responses | No stack traces or internal details returned to clients |

---

## Deferred / Future Work

| Item | Priority | Notes |
|---|---|---|
| Nonce-based CSP | Medium | Eliminates `'unsafe-inline'` and `'unsafe-eval'`. Requires Next.js middleware. |
| Redis-backed rate limiting | Low | Makes rate limit effective across serverless instances. Use Upstash. |
| `esbuild` / `vitest` CVEs | Low | Dev-only; fix requires `vitest@4.x` breaking change upgrade. |
| `postcss` CVE in Next.js | Low | Vendored inside Next.js; waiting for upstream patch. |
| `serverActions.allowedOrigins` | Low | Add production domain alongside `localhost:3000` in `next.config.ts`. |

---

## Audit Checklist Status

```
Authentication
[N/A] Passwords — no user accounts
[N/A] Sessions — stateless

Authorization
[N/A] No multi-user data; no per-user resources

Input
[✓] Message validated at API boundary (type, length, non-empty)
[✓] No SQL queries
[✓] LLM output URLs sanitized before rendering
[✓] Server-side URL fetches go only to Cloudflare Turnstile endpoint (fixed domain, no user input)

Data
[✓] No secrets in source code or git history
[✓] API errors return generic Thai-language messages, no internals
[N/A] No PII stored

Infrastructure
[✓] Security headers on all routes
[✓] CORS not explicitly widened (Vercel default: * on static; API has no CORS headers)
[✓] No critical npm vulnerabilities
[✓] Error responses safe
[✓] Cloudflare WAF: suspicious bot challenge rule active
[✓] Cloudflare Bot Fight Mode enabled
[✓] Cloudflare WAF: rate limit 5 req/10s per IP on /api/*

Supply Chain
[✓] package-lock.json committed
[~] npm ci used in CI (Vercel default)
[✓] form-data CRLF injection patched

AI / LLM
[✓] LLM output treated as untrusted (ReactMarkdown, no rehypeRaw, href sanitized)
[✓] No secrets in LLM context window
[✓] No tool use / agent actions — model is read-only
[✓] Token consumption bounded (max_tokens: 1024, message cap: 500 chars)
```
