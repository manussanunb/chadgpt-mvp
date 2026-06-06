import { describe, it, expect, vi } from "vitest";
import { chat } from "../chat";
import type { PolicyItem, LLMProvider } from "../types";

function makeItem(embedding: number[], category: string, source_url: string): PolicyItem {
  return {
    text: `ข้อมูล ${category}`,
    category,
    source_url,
    source_file: "test",
    embedding,
  };
}

const mockProvider: LLMProvider = {
  generate: vi.fn().mockResolvedValue("คำตอบทดสอบ"),
};

const db: PolicyItem[] = [
  makeItem([1, 0, 0], "สุขภาพ", "https://example.com/1"),
  makeItem([0, 1, 0], "การขนส่ง", "https://example.com/2"),
];

describe("chat orchestrator", () => {
  it("returns fallback when no results match", async () => {
    const embedFn = vi.fn().mockResolvedValue([0, 0, 0]);
    const result = await chat("คำถามที่ไม่เกี่ยวข้อง", db, mockProvider, embedFn);

    expect(result.answer).toContain("ไม่พบข้อมูล");
    expect(result.sources).toHaveLength(0);
    expect(mockProvider.generate).not.toHaveBeenCalled();
  });

  it("calls provider when results are found", async () => {
    const generateMock = vi.fn().mockResolvedValue("คำตอบสุขภาพ");
    const provider: LLMProvider = { generate: generateMock };
    const embedFn = vi.fn().mockResolvedValue([1, 0, 0]);

    const result = await chat("นโยบายสุขภาพ", db, provider, embedFn);

    expect(generateMock).toHaveBeenCalledOnce();
    expect(result.answer).toBe("คำตอบสุขภาพ");
  });

  it("returns populated sources when results are found", async () => {
    const provider: LLMProvider = { generate: vi.fn().mockResolvedValue("ตอบ") };
    const embedFn = vi.fn().mockResolvedValue([1, 0, 0]);

    const result = await chat("สุขภาพ", db, provider, embedFn);

    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0]).toHaveProperty("category");
    expect(result.sources[0]).toHaveProperty("source_url");
  });

  it("deduplicates sources by source_url", async () => {
    const duplicateDb: PolicyItem[] = [
      makeItem([0.9, 0, 0], "สุขภาพ A", "https://example.com/1"),
      makeItem([0.8, 0, 0], "สุขภาพ B", "https://example.com/1"),
    ];
    const provider: LLMProvider = { generate: vi.fn().mockResolvedValue("ตอบ") };
    const embedFn = vi.fn().mockResolvedValue([1, 0, 0]);

    const result = await chat("สุขภาพ", duplicateDb, provider, embedFn);

    const urls = result.sources.map((s) => s.source_url);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
