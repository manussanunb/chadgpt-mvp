export interface PolicyItem {
  text: string;
  category: string;
  subcategory?: string;
  source_url: string;
  source_file: string;
  embedding: number[];
}

export interface SearchResult {
  item: PolicyItem;
  score: number;
}

export interface LLMProvider {
  generate(systemPrompt: string, userMessage: string): Promise<string>;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  answer: string;
  sources: { category: string; source_url: string }[];
}
