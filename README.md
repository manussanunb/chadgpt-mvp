# ChadGPT

Thai-language chat agent that lets Bangkok residents ask natural questions about Chadchart Sittipunt's policies and progress. The agent answers in Chadchart's voice — energetic, data-driven, and action-oriented.

## How it works

1. **Offline** — policy and progress JSON files are embedded with Gemini and stored in `data/embedded/`
2. **At query time** — the user's question is embedded, matched against stored vectors (cosine similarity), and the top results are sent to the LLM with Chadchart's persona prompt
3. **General questions** with no policy match are answered freely in Chadchart's voice using his known philosophy

```
User question
  → embed question (Gemini gemini-embedding-001)
  → cosine search across ~200 policy/progress items (in-memory, no DB)
  → if match: answer grounded in policy data
  → if no match: answer as Chadchart using general philosophy
  → return { answer, sources }
```

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Embeddings | Gemini `gemini-embedding-001` |
| LLM | Gemini `gemini-2.5-flash` (default), switchable to Claude or OpenAI |
| Search | In-memory cosine similarity — no vector database |
| Styling | Tailwind CSS |
| Hosting | Vercel (demo) / Cloudflare Workers (future) |

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```bash
GEMINI_API_KEY=your_key_here   # required — get from https://aistudio.google.com/apikey
LLM_PROVIDER=gemini            # gemini | claude | openai
```

### 3. Generate embeddings (run once)

```bash
npm run embed
```

Reads all 8 policy/progress JSON files from `docs/Chadchart Policy/`, calls Gemini embeddings API, and writes output to `data/embedded/`. Takes ~2 minutes. Re-run only when source data changes.

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Commands

```bash
npm run dev        # start dev server
npm run build      # production build
npm run embed      # generate embeddings (offline, run once)
npm run typecheck  # type check
npm run test       # unit tests
npm run lint       # lint
```

## Switching LLM providers

Set `LLM_PROVIDER` in `.env.local` and restart:

```bash
LLM_PROVIDER=claude    # requires CLAUDE_API_KEY
LLM_PROVIDER=openai    # requires OPENAI_API_KEY
LLM_PROVIDER=gemini    # default, requires GEMINI_API_KEY
```

No code changes needed — providers implement a common interface.

## Project structure

```
src/
  engine/           # platform-agnostic core (no Node/Workers-specific APIs)
    types.ts        # shared interfaces
    search.ts       # cosine similarity search
    chat.ts         # orchestrator: embed → search → generate
    providers/      # Gemini, Claude, OpenAI implementations + factory
  adapters/
    vercel.ts       # Next.js adapter (loads DB from bundled JSON)
    cloudflare.ts   # Cloudflare Workers adapter (stub — see migration guide inside)
  data/
    loader.ts       # loads all embedded JSON files into memory

app/
  api/chat/route.ts # POST /api/chat — validates input, calls engine
  page.tsx          # chat UI

components/
  ChatWindow.tsx    # message list + starter question chips
  MessageBubble.tsx # individual message with markdown rendering
  ChatInput.tsx     # textarea + send button

scripts/
  embed.ts          # one-time embedding generation script

data/
  embedded/         # pre-generated embeddings (committed — no DB needed)

docs/
  Chadchart Policy/ # source policy and progress JSON files
  specs/            # SPEC.md and PLAN.md
```

## Deploy to Vercel

```bash
vercel

# add environment variables
vercel env add GEMINI_API_KEY
vercel env add LLM_PROVIDER

# deploy to production
vercel --prod
```

The `data/embedded/` files are committed, so Vercel does not need to run `npm run embed` during build.

## Migrating to Cloudflare Workers

See `src/adapters/cloudflare.ts` for the migration guide. The engine (`src/engine/`) is unchanged — only the adapter differs (R2 for data loading, Workers env bindings for secrets).

## Cost

Designed to run for free:

| Service | Free tier |
|---|---|
| Vercel | 100GB bandwidth / month |
| Gemini (generation) | 1,500 requests / day |
| Gemini (embeddings) | included in free tier |
| Database | none — in-memory search |
