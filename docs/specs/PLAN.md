# Implementation Plan: ChadGPT

## Overview

Build the ChadGPT chat agent in four phases: project scaffolding, the offline embedding script, the engine + API, and the web UI. The Cloudflare adapter is stubbed in Phase 3 so the boundary is established early without blocking the demo.

## Architecture Decisions

- `src/engine/` is built first and has zero platform-specific code — it is the stable core everything else depends on
- The embedding script runs once offline and outputs committed JSON files — no runtime embedding cost, no database
- LLM providers are behind a single interface; the factory reads `LLM_PROVIDER` env var at cold start
- Vercel adapter is a thin shim; swapping to Cloudflare means writing `cloudflare.ts` only

## Dependency Graph

```
package.json / tsconfig / next.config
        │
        ▼
src/engine/types.ts
        │
        ├──────────────────────────────┐
        ▼                              ▼
scripts/embed.ts              src/engine/search.ts
        │                              │
        ▼                              ▼
data/embedded/*.json     src/engine/providers/
        │                     index.ts + gemini.ts
        ▼                     claude.ts + openai.ts
src/data/loader.ts                     │
        │                              ▼
        └──────────────► src/engine/chat.ts
                                       │
                         ┌─────────────┴──────────────┐
                         ▼                             ▼
              src/adapters/vercel.ts     src/adapters/cloudflare.ts
                         │
                         ▼
              app/api/chat/route.ts
                         │
                         ▼
                  components/ + app/page.tsx
```

---

## Phase 1: Project Scaffolding

### Task 1: Initialize Next.js project and install dependencies

**Description:** Bootstrap the Next.js 14 App Router project with TypeScript. Install all runtime and dev dependencies. Configure tsconfig paths. Add npm scripts for embed, typecheck, and lint.

**Acceptance criteria:**
- [ ] `npm run dev` starts the dev server at localhost:3000 with no errors
- [ ] `npm run typecheck` passes with zero errors on an empty project
- [ ] `npm run lint` passes
- [ ] `tsconfig.json` has `"paths": { "@/engine/*": ["src/engine/*"], "@/data/*": ["src/data/*"] }`

**Verification:**
- [ ] `npm run dev` → browser shows default Next.js page
- [ ] `npm run build` succeeds

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `.gitignore` (add `.env.local`, `data/embedded/` is NOT ignored — committed)

**Estimated scope:** Small

---

### Task 2: Create shared types and .env template

**Description:** Write `src/engine/types.ts` with all core interfaces. Create `.env.example` documenting every env var. This file is the contract all other modules import from.

**Acceptance criteria:**
- [ ] `PolicyItem`, `SearchResult`, `LLMProvider`, `ChatRequest`, `ChatResponse` are exported from `src/engine/types.ts`
- [ ] `.env.example` documents `GEMINI_API_KEY`, `LLM_PROVIDER`, `CLAUDE_API_KEY`, `OPENAI_API_KEY`
- [ ] No implementation code — types only

**Verification:**
- [ ] `npm run typecheck` passes

**Dependencies:** Task 1

**Files likely touched:**
- `src/engine/types.ts`
- `.env.example`

**Estimated scope:** Small

---

### Checkpoint: Phase 1
- [ ] `npm run dev` starts without error
- [ ] `npm run typecheck` passes
- [ ] `src/engine/types.ts` exports all interfaces

---

## Phase 2: Offline Embedding Script

### Task 3: Write the embedding generation script

**Description:** Write `scripts/embed.ts`. Reads all 8 source JSON files from `docs/Chadchart Policy/`. For each item, builds a combined Thai text string, calls `text-embedding-004`, and writes output to `data/embedded/{filename}.json`. Adds `embedding` (768-dim array) and `source_file` (filename stem) fields to each item. Normalises the `text` field from whichever source field is present (`policy_description` or `progress_text`). Adds 200ms delay between API calls.

**Acceptance criteria:**
- [ ] `npm run embed` runs to completion without errors
- [ ] `data/embedded/` contains exactly 8 JSON files after running
- [ ] Each item in each file has `embedding` (array of 768 numbers), `source_file` (string), and `text` (string)
- [ ] Script logs `✓ [source_file] item N/total` for each item
- [ ] Script logs total items embedded per file and overall

**Verification:**
- [ ] Run `npm run embed` with a valid `GEMINI_API_KEY` in `.env.local`
- [ ] Inspect one output file: confirm `embedding` is a 768-element array
- [ ] `npm run typecheck` passes (script uses `ts-node` or `tsx`)

**Dependencies:** Task 2

**Files likely touched:**
- `scripts/embed.ts`
- `package.json` (add `embed` script using `tsx`)
- `data/embedded/` (generated output — committed)

**Estimated scope:** Medium

---

### Checkpoint: Phase 2
- [ ] `npm run embed` runs without errors
- [ ] All 8 `data/embedded/*.json` files exist and contain embeddings
- [ ] One file spot-checked: embedding array length = 768

---

## Phase 3: Engine Core + API

### Task 4: Write the data loader

**Description:** Write `src/data/loader.ts`. Reads all 8 embedded JSON files and returns a single flat `PolicyItem[]`. This is called once at cold start — not per request. Must use only Web-standard or Next.js-compatible APIs (no `fs` — use dynamic `import()` of JSON files).

**Acceptance criteria:**
- [ ] `loadDatabase()` returns a `PolicyItem[]` with items from all 8 files combined
- [ ] No `fs` or Node.js-only imports inside `src/data/loader.ts`
- [ ] Each item conforms to the `PolicyItem` interface

**Verification:**
- [ ] `npm run typecheck` passes
- [ ] Write a quick manual test: log `db.length` at startup and confirm it matches total item count across all 8 files

**Dependencies:** Task 3 (embedded files must exist)

**Files likely touched:**
- `src/data/loader.ts`

**Estimated scope:** Small

---

### Task 5: Write the search module

**Description:** Write `src/engine/search.ts`. Implements `dotProduct()` and `semanticSearch()` as specified in the spec. `semanticSearch` takes a pre-computed query vector (not the raw question string — embedding is the caller's concern), scores all items, filters by `MIN_SCORE = 0.5`, sorts descending, returns top `TOP_K = 5`.

**Acceptance criteria:**
- [ ] `dotProduct([1,0], [1,0])` returns `1`
- [ ] `dotProduct([1,0], [0,1])` returns `0`
- [ ] `semanticSearch` with a query vector that matches nothing returns `[]`
- [ ] `semanticSearch` returns results sorted by score descending
- [ ] Results with score < 0.5 are excluded

**Verification:**
- [ ] Unit tests in `src/engine/__tests__/search.test.ts` cover the above cases
- [ ] `npm run typecheck` passes

**Dependencies:** Task 2

**Files likely touched:**
- `src/engine/search.ts`
- `src/engine/__tests__/search.test.ts`

**Estimated scope:** Small

---

### Task 6: Write the Gemini LLM provider

**Description:** Write `src/engine/providers/gemini.ts`. Implements `LLMProvider`. The `generate(systemPrompt, userMessage)` method calls `gemini-2.0-flash` and returns the text response. Also exports `embedText(text: string, apiKey: string): Promise<number[]>` — the shared embedding function used by both the script (Task 3) and the chat engine (Task 7). Write `src/engine/providers/index.ts` with the `createProvider` factory function.

**Acceptance criteria:**
- [ ] `GeminiProvider.generate()` returns a non-empty string
- [ ] `embedText()` returns an array of length 768
- [ ] `createProvider({ LLM_PROVIDER: 'gemini', GEMINI_API_KEY: '...' })` returns a `GeminiProvider`
- [ ] `createProvider({ LLM_PROVIDER: 'claude', ... })` returns a `ClaudeProvider` (can throw "not implemented" for now)
- [ ] `createProvider({ LLM_PROVIDER: 'openai', ... })` returns an `OpenAIProvider` (can throw "not implemented" for now)

**Verification:**
- [ ] Unit test: factory returns correct class per `LLM_PROVIDER` value (mock the classes)
- [ ] `npm run typecheck` passes

**Dependencies:** Task 2

**Files likely touched:**
- `src/engine/providers/gemini.ts`
- `src/engine/providers/index.ts`
- `src/engine/__tests__/providers.test.ts`

**Estimated scope:** Medium

---

### Task 7: Write Claude and OpenAI providers

**Description:** Write `src/engine/providers/claude.ts` (using `@anthropic-ai/sdk`) and `src/engine/providers/openai.ts` (using `openai`). Both implement `LLMProvider`. Both use the same `generate(systemPrompt, userMessage)` signature.

**Acceptance criteria:**
- [ ] `ClaudeProvider.generate()` calls `claude-haiku-4-5-20251001` model
- [ ] `OpenAIProvider.generate()` calls `gpt-4o-mini` model
- [ ] Both classes compile without error
- [ ] Switching `LLM_PROVIDER=claude` in `.env.local` and restarting dev server uses Claude

**Verification:**
- [ ] `npm run typecheck` passes
- [ ] Manual: set `LLM_PROVIDER=claude`, hit `/api/chat`, confirm response arrives (requires `CLAUDE_API_KEY`)

**Dependencies:** Task 6

**Files likely touched:**
- `src/engine/providers/claude.ts`
- `src/engine/providers/openai.ts`

**Estimated scope:** Small

---

### Task 8: Write the chat orchestrator

**Description:** Write `src/engine/chat.ts`. Implements the main `chat(message, db, provider, embedFn)` function. Embeds the user question, runs semantic search, returns Thai fallback if no results, builds context string, calls the LLM provider, returns `ChatResponse`. The system prompt is defined in this file.

**Acceptance criteria:**
- [ ] `chat()` returns `{ answer: string, sources: [...] }` conforming to `ChatResponse`
- [ ] If `semanticSearch` returns `[]`, `chat()` returns the Thai fallback without calling `provider.generate()`
- [ ] `sources` contains deduplicated `{ category, source_url }` from the top results
- [ ] Context string includes category and text for each result, separated clearly

**Verification:**
- [ ] Unit test: mock `embedFn` and `provider` — verify fallback path when search returns empty
- [ ] Unit test: verify `sources` is populated when results are returned
- [ ] `npm run typecheck` passes

**Dependencies:** Tasks 4, 5, 6

**Files likely touched:**
- `src/engine/chat.ts`
- `src/engine/__tests__/chat.test.ts`

**Estimated scope:** Medium

---

### Task 9: Write the Vercel adapter and API route

**Description:** Write `src/adapters/vercel.ts` (initializes the DB and provider once, exports a `handleChat` function) and `app/api/chat/route.ts` (Next.js POST handler). Validates input: `message` must be a non-empty string, max 500 chars. Returns 400 on invalid input, 500 on provider error with a safe Thai error message.

**Description of Cloudflare stub:** Write `src/adapters/cloudflare.ts` as a documented stub — the function signature, comments explaining what differs (R2 loading vs import, Workers env bindings), but `throw new Error('Not implemented — see SPEC.md')` in the body. This establishes the boundary now without blocking the demo.

**Acceptance criteria:**
- [ ] `POST /api/chat` with `{ "message": "ชัชชาติทำอะไรด้านสุขภาพบ้าง?" }` returns a Thai answer in under 5 seconds
- [ ] `POST /api/chat` with `{ "message": "" }` returns HTTP 400
- [ ] `POST /api/chat` with a message over 500 chars returns HTTP 400
- [ ] Raw embeddings are never included in the response JSON
- [ ] `src/adapters/cloudflare.ts` exists with correct function signature and stub body

**Verification:**
- [ ] `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":"ชัชชาติทำอะไรด้านสุขภาพบ้าง?"}'` returns a JSON response with `answer` and `sources`
- [ ] Empty message returns 400
- [ ] `npm run typecheck` passes

**Dependencies:** Task 8

**Files likely touched:**
- `src/adapters/vercel.ts`
- `src/adapters/cloudflare.ts`
- `app/api/chat/route.ts`

**Estimated scope:** Medium

---

### Checkpoint: Phase 3
- [ ] `curl` test against `/api/chat` returns a valid Thai answer
- [ ] Empty / oversized input returns 400
- [ ] All unit tests pass: `npm test`
- [ ] `npm run typecheck` passes clean
- [ ] `src/adapters/cloudflare.ts` stub exists with correct signature

---

## Phase 4: Web UI

### Task 10: Build MessageBubble and ChatInput components

**Description:** Write `components/MessageBubble.tsx` (renders a single message with role-based styling — user bubble right-aligned, assistant bubble left-aligned, sources as links below assistant messages) and `components/ChatInput.tsx` (textarea + send button, Enter to submit, Shift+Enter for newline, disabled during loading).

**Acceptance criteria:**
- [ ] User messages render right-aligned with distinct background
- [ ] Assistant messages render left-aligned
- [ ] Sources render as clickable Thai category labels below assistant messages
- [ ] Input is disabled and shows a loading indicator while `isLoading` is true
- [ ] Enter key submits, Shift+Enter adds newline

**Verification:**
- [ ] Visual check in browser at localhost:3000 (after Task 11 wires it up)

**Dependencies:** Task 9

**Files likely touched:**
- `components/MessageBubble.tsx`
- `components/ChatInput.tsx`

**Estimated scope:** Medium

---

### Task 11: Build ChatWindow and main page

**Description:** Write `components/ChatWindow.tsx` (scrollable message list, auto-scrolls to bottom on new message, shows starter question chips before first message) and `app/page.tsx` (wires state: `messages[]`, `isLoading`, input value; calls `/api/chat`; renders ChatWindow).

Starter question chips (Thai):
- "ชัชชาติทำอะไรด้านสุขภาพไปแล้วบ้าง?"
- "นโยบายด้านการศึกษามีอะไรบ้าง?"
- "แก้ปัญหารถติดยังไง?"
- "นโยบายด้านสิ่งแวดล้อมมีอะไรบ้าง?"

Clicking a chip populates the input and submits immediately.

**Acceptance criteria:**
- [ ] Opening the page shows starter question chips
- [ ] Clicking a chip sends the question and hides the chips
- [ ] Messages accumulate in the window without clearing
- [ ] Window auto-scrolls to the latest message
- [ ] Loading spinner or indicator is visible while awaiting the API response
- [ ] Error from API shows a Thai error message in the chat window (not an alert/crash)

**Verification:**
- [ ] Full conversation flow in browser: click chip → see user message → see loading → see answer with sources
- [ ] Type a custom question → submit → same flow

**Dependencies:** Task 10

**Files likely touched:**
- `components/ChatWindow.tsx`
- `app/page.tsx`
- `app/layout.tsx`
- `app/globals.css`

**Estimated scope:** Medium

---

### Checkpoint: Phase 4 (Demo Ready)
- [ ] Full conversation flow works in browser end-to-end
- [ ] Starter chips visible on load
- [ ] Sources render with links below assistant messages
- [ ] Loading state visible during API call
- [ ] `npm run build` succeeds with no TypeScript errors
- [ ] All unit tests pass

---

## Phase 5: Deploy

### Task 12: Deploy to Vercel and smoke test

**Description:** Push to GitHub. Connect repo to Vercel. Configure environment variables (`GEMINI_API_KEY`, `LLM_PROVIDER`). Deploy. Run 5 Thai test questions covering each data category (people, city, economy, system). Confirm responses are accurate and sources link correctly.

**Acceptance criteria:**
- [ ] App is live at a public Vercel URL
- [ ] All 5 test questions return relevant Thai answers in under 5 seconds
- [ ] No API keys are visible in the browser (dev tools network tab)
- [ ] `npm run embed` output is committed — deploy does not re-run embeddings

**Verification:**
- [ ] Test questions (one per category):
  1. "ชัชชาติทำอะไรด้านสุขภาพบ้าง?" (people)
  2. "นโยบายรถติดมีอะไรบ้าง?" (city)
  3. "ด้านเศรษฐกิจทำอะไรไปบ้าง?" (economy)
  4. "นโยบายการศึกษาเป็นยังไง?" (people)
  5. "ปัญหาน้ำท่วมแก้ยังไง?" (city)

**Dependencies:** Task 11

**Files likely touched:**
- `vercel.json` (if needed for route config)
- `.gitignore` (confirm `data/embedded/` is not ignored)

**Estimated scope:** Small

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Gemini free-tier rate limit hit during `embed` | Medium | 200ms delay between calls; script is resumable (skip already-embedded items) |
| Vercel 10s function timeout on slow Gemini calls | Medium | Use Gemini streaming; set `maxDuration = 30` in route config (Vercel hobby allows 60s on some plans) |
| `data/embedded/*.json` too large for Vercel bundle | Low | Total size ~10MB across 8 files — well within Vercel's 250MB limit |
| Thai semantic mismatch (informal vs formal vocabulary) | Medium | Tune `MIN_SCORE` after seeing real traffic; start at 0.5 and lower if too many fallbacks |
| API key accidentally committed | High | `.gitignore` blocks `.env.local`; CI lint step checks for key patterns |

---

## Task Order Summary

```
Task 1  → Task 2  → Task 3 (embed script)
                  → Task 4 (loader)
                  → Task 5 (search)
                  → Task 6 (Gemini provider)
                      → Task 7 (Claude + OpenAI providers)
                      → Task 8 (chat orchestrator)
                          → Task 9 (Vercel adapter + API route)
                              → Task 10 (MessageBubble + ChatInput)
                                  → Task 11 (ChatWindow + page)
                                      → Task 12 (Deploy)
```

Tasks 3, 4, 5, and 6 all depend on Task 2 but are independent of each other — they can be built in any order within Phase 2/3.
