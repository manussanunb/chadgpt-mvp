import type { LLMProvider } from "@/engine/types";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";

export interface ProviderConfig {
  LLM_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export function createProvider(config: ProviderConfig): LLMProvider {
  switch (config.LLM_PROVIDER) {
    case "claude": {
      if (!config.CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is required when LLM_PROVIDER=claude");
      return new ClaudeProvider(config.CLAUDE_API_KEY);
    }
    case "openai": {
      if (!config.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
      return new OpenAIProvider(config.OPENAI_API_KEY);
    }
    default: {
      if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required when LLM_PROVIDER=gemini");
      return new GeminiProvider(config.GEMINI_API_KEY);
    }
  }
}

export { GeminiProvider, ClaudeProvider, OpenAIProvider };
