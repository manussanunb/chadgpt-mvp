import type { ChatRequest, ChatResponse } from "@/engine/types";
import { loadDatabase } from "@/data/loader";
import { createProvider } from "@/engine/providers/index";
import { embedText } from "@/engine/providers/gemini";
import { chat } from "@/engine/chat";

let _provider: ReturnType<typeof createProvider> | null = null;

function getProvider() {
  if (!_provider) {
    _provider = createProvider({
      LLM_PROVIDER: process.env.LLM_PROVIDER,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    });
  }
  return _provider;
}

function getEmbedFn() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for embeddings");
  return (text: string) => embedText(text, apiKey);
}

export async function handleChat(req: ChatRequest): Promise<ChatResponse> {
  const db = loadDatabase();
  const provider = getProvider();
  const embedFn = getEmbedFn();
  return chat(req.message, db, provider, embedFn);
}
