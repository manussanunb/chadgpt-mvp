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
  db: PolicyItem[],
  topK: number = TOP_K
): SearchResult[] {
  return db
    .map((item) => ({ item, score: dotProduct(queryVector, item.embedding) }))
    .filter((r) => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

function tokenize(text: string): string[] {
  if (!text) return [];
  const segments = Array.from(segmenter.segment(text));
  return segments
    .filter(s => s.isWordLike)
    .map(s => s.segment.toLowerCase());
}

function lexicalScore(queryTokens: string[], docTokens: string[]): number {
  if (queryTokens.length === 0) return 0;
  let score = 0;
  for (const qt of queryTokens) {
    const tf = docTokens.filter(t => t === qt).length;
    if (tf > 0) {
      score += 1 + Math.log(tf); // dampened Term Frequency
    }
  }
  return score;
}

export function hybridSearch(
  query: string,
  queryVector: number[],
  db: PolicyItem[],
  topK: number = TOP_K
): SearchResult[] {
  const queryTokens = tokenize(query);

  // 1. Calculate base semantic and lexical scores
  const rawResults = db.map(item => {
    const semantic = dotProduct(queryVector, item.embedding);
    const docTokens = tokenize(item.text);
    const lexical = lexicalScore(queryTokens, docTokens);
    return { item, semantic, lexical };
  });

  // 2. Rank Semantic
  const semanticRanked = [...rawResults].sort((a, b) => b.semantic - a.semantic);
  const semanticRanks = new Map<PolicyItem, number>();
  semanticRanked.forEach((res, i) => semanticRanks.set(res.item, i + 1));

  // 3. Rank Lexical
  const lexicalRanked = [...rawResults].sort((a, b) => b.lexical - a.lexical);
  const lexicalRanks = new Map<PolicyItem, number>();
  lexicalRanked.forEach((res, i) => lexicalRanks.set(res.item, i + 1));

  // 4. Combine using RRF
  const RRF_K = 60;
  let finalResults = rawResults.map(res => {
    const sRank = semanticRanks.get(res.item) || 1000;
    const lRank = lexicalRanks.get(res.item) || 1000;
    
    // Base RRF Score
    let rrfScore = (1 / (RRF_K + sRank)) + (1 / (RRF_K + lRank));

    return { item: res.item, score: rrfScore, semanticScore: res.semantic, lexicalScore: res.lexical };
  });

  // 5. Filter out very bad results (either lexical match or good semantic match needed)
  finalResults = finalResults.filter(r => r.semanticScore >= 0.4 || r.lexicalScore > 0);

  return finalResults
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(r => ({ item: r.item, score: r.score }));
}
