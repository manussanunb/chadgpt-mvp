import { describe, it, expect } from "vitest";
import { createProvider, GeminiProvider, ClaudeProvider, OpenAIProvider } from "../providers/index";

describe("createProvider factory", () => {
  it("returns GeminiProvider by default", () => {
    const p = createProvider({ GEMINI_API_KEY: "test" });
    expect(p).toBeInstanceOf(GeminiProvider);
  });

  it("returns GeminiProvider when LLM_PROVIDER=gemini", () => {
    const p = createProvider({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "test" });
    expect(p).toBeInstanceOf(GeminiProvider);
  });

  it("returns ClaudeProvider when LLM_PROVIDER=claude", () => {
    const p = createProvider({ LLM_PROVIDER: "claude", CLAUDE_API_KEY: "test" });
    expect(p).toBeInstanceOf(ClaudeProvider);
  });

  it("returns OpenAIProvider when LLM_PROVIDER=openai", () => {
    const p = createProvider({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "test" });
    expect(p).toBeInstanceOf(OpenAIProvider);
  });

  it("throws when GEMINI_API_KEY is missing", () => {
    expect(() => createProvider({})).toThrow("GEMINI_API_KEY is required");
  });

  it("throws when CLAUDE_API_KEY is missing for claude provider", () => {
    expect(() => createProvider({ LLM_PROVIDER: "claude" })).toThrow("CLAUDE_API_KEY is required");
  });

  it("throws when OPENAI_API_KEY is missing for openai provider", () => {
    expect(() => createProvider({ LLM_PROVIDER: "openai" })).toThrow("OPENAI_API_KEY is required");
  });
});
