import { describe, it, expect } from "vitest";
import { dotProduct, semanticSearch } from "../search";
import type { PolicyItem } from "../types";

function makeItem(embedding: number[], category = "test"): PolicyItem {
  return {
    text: "test",
    category,
    source_url: "https://example.com",
    source_file: "test",
    embedding,
  };
}

describe("dotProduct", () => {
  it("returns 1 for identical unit vectors", () => {
    expect(dotProduct([1, 0], [1, 0])).toBe(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(dotProduct([1, 0], [0, 1])).toBe(0);
  });

  it("returns -1 for opposite unit vectors", () => {
    expect(dotProduct([1, 0], [-1, 0])).toBe(-1);
  });

  it("handles multi-dimension vectors", () => {
    expect(dotProduct([0.6, 0.8], [0.6, 0.8])).toBeCloseTo(1, 5);
  });
});

describe("semanticSearch", () => {
  const db = [
    makeItem([1, 0, 0], "health"),
    makeItem([0, 1, 0], "transport"),
    makeItem([0, 0, 1], "economy"),
    makeItem([0.9, 0.1, 0], "health2"),
  ];

  it("returns empty array when no results pass MIN_SCORE", () => {
    const result = semanticSearch([0, 0, 0], db);
    expect(result).toHaveLength(0);
  });

  it("returns results sorted by score descending", () => {
    const result = semanticSearch([1, 0, 0], db);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1]?.score ?? 0);
  });

  it("returns at most 5 results", () => {
    const largDb = Array.from({ length: 20 }, () => makeItem([1, 0, 0]));
    const result = semanticSearch([1, 0, 0], largDb);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("excludes items scoring below 0.5", () => {
    const result = semanticSearch([1, 0, 0], db);
    expect(result.every((r) => r.score >= 0.5)).toBe(true);
  });

  it("returns the correct best match category", () => {
    const result = semanticSearch([1, 0, 0], db);
    expect(result[0].item.category).toBe("health");
  });
});
