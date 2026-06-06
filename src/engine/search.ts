import type { PolicyItem, SearchResult } from "@/engine/types";

const TOP_K = 5;
const MIN_SCORE = 0.5;

export function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

export function semanticSearch(
  queryVector: number[],
  db: PolicyItem[]
): SearchResult[] {
  return db
    .map((item) => ({ item, score: dotProduct(queryVector, item.embedding) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);
}
