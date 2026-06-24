import type { PostHog } from "posthog-node";
import type { LLMProvider } from "@/engine/types";
import { GeminiProvider } from "./gemini";
import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";
import { CascadeProvider } from "./cascade";

export interface ProviderConfig {
  LLM_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_API_KEY_3?: string;
  GROQ_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  OPENAI_API_KEY?: string;
  posthog?: PostHog;
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

      const providers: LLMProvider[] = [
        new GeminiProvider(config.GEMINI_API_KEY, config.posthog),
      ];

      if (config.GEMINI_API_KEY_2) {
        providers.push(new GeminiProvider(config.GEMINI_API_KEY_2));
      }
      if (config.GEMINI_API_KEY_3) {
        providers.push(new GeminiProvider(config.GEMINI_API_KEY_3));
      }
      if (config.GROQ_API_KEY) {
        providers.push(
          new OpenAIProvider(config.GROQ_API_KEY, {
            baseURL: "https://api.groq.com/openai/v1",
            model: "llama-3.3-70b-versatile",
          })
        );
      }

      return providers.length === 1 ? providers[0] : new CascadeProvider(providers);
    }
  }
}

export { GeminiProvider, ClaudeProvider, OpenAIProvider, CascadeProvider };
