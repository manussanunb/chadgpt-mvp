/**
 * Cloudflare Workers adapter — STUB
 *
 * To migrate from Vercel to Workers:
 * 1. Replace loadDatabase() with R2 fetch: env.BUCKET.get('policies.json')
 * 2. Replace process.env with Workers env bindings (typed via Env interface)
 * 3. Export a default fetch handler instead of named functions
 * 4. Add wrangler.toml with R2 bucket binding and secret bindings
 *
 * The engine (chat, search, providers) is unchanged — only this file differs.
 *
 * See docs/specs/SPEC.md § Platform Adapters for details.
 */

import type { ChatRequest, ChatResponse } from "@/engine/types";

// Cloudflare Workers env bindings (define in wrangler.toml)
export interface Env {
  BUCKET: { get(key: string): Promise<{ json(): Promise<unknown> } | null> };
  GEMINI_API_KEY: string;
  LLM_PROVIDER?: string;
  CLAUDE_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export async function handleChat(
  _req: ChatRequest,
  _env: Env
): Promise<ChatResponse> {
  throw new Error(
    "Cloudflare Workers adapter not yet implemented. See src/adapters/cloudflare.ts for migration guide."
  );
}
