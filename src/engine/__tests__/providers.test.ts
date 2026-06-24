import { describe, it, expect, vi } from "vitest";
import { createProvider, GeminiProvider, ClaudeProvider, OpenAIProvider, CascadeProvider } from "../providers/index";
import type { LLMProvider } from "../types";

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

  it("returns CascadeProvider when backup Gemini keys are present", () => {
    const p = createProvider({ GEMINI_API_KEY: "key1", GEMINI_API_KEY_2: "key2" });
    expect(p).toBeInstanceOf(CascadeProvider);
  });

  it("returns CascadeProvider when GROQ_API_KEY is present", () => {
    const p = createProvider({ GEMINI_API_KEY: "key1", GROQ_API_KEY: "groq-key" });
    expect(p).toBeInstanceOf(CascadeProvider);
  });

  it("returns single GeminiProvider when no backup keys are provided", () => {
    const p = createProvider({ GEMINI_API_KEY: "key1" });
    expect(p).toBeInstanceOf(GeminiProvider);
  });
});

describe("CascadeProvider", () => {
  function makeProvider(result: string | Error): LLMProvider {
    return {
      generate: vi.fn().mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
      ),
    };
  }

  function rateLimit(): Error {
    return Object.assign(new Error("Rate limited"), { status: 429 });
  }

  it("returns the primary provider response when it succeeds", async () => {
    const primary = makeProvider("hello from primary");
    const backup = makeProvider("hello from backup");
    const cascade = new CascadeProvider([primary, backup]);

    const result = await cascade.generate("sys", "msg");

    expect(result).toBe("hello from primary");
    expect(backup.generate).not.toHaveBeenCalled();
  });

  it("falls through to backup on 429", async () => {
    const primary = makeProvider(rateLimit());
    const backup = makeProvider("hello from backup");
    const cascade = new CascadeProvider([primary, backup]);

    const result = await cascade.generate("sys", "msg");

    expect(result).toBe("hello from backup");
  });

  it("cascades through all providers on consecutive 429s", async () => {
    const p1 = makeProvider(rateLimit());
    const p2 = makeProvider(rateLimit());
    const p3 = makeProvider("hello from third");
    const cascade = new CascadeProvider([p1, p2, p3]);

    const result = await cascade.generate("sys", "msg");

    expect(result).toBe("hello from third");
    expect(p1.generate).toHaveBeenCalledOnce();
    expect(p2.generate).toHaveBeenCalledOnce();
    expect(p3.generate).toHaveBeenCalledOnce();
  });

  it("throws last 429 error when all providers are exhausted", async () => {
    const p1 = makeProvider(rateLimit());
    const p2 = makeProvider(rateLimit());
    const cascade = new CascadeProvider([p1, p2]);

    await expect(cascade.generate("sys", "msg")).rejects.toMatchObject({ status: 429 });
  });

  it("does NOT fall through on non-quota errors", async () => {
    const primary = makeProvider(new Error("Internal server error"));
    const backup = makeProvider("should not be called");
    const cascade = new CascadeProvider([primary, backup]);

    await expect(cascade.generate("sys", "msg")).rejects.toThrow("Internal server error");
    expect(backup.generate).not.toHaveBeenCalled();
  });
});
