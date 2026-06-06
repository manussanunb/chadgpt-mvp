import { GoogleGenAI } from "@google/genai";
import type { LLMProvider } from "@/engine/types";

export class GeminiProvider implements LLMProvider {
  private ai: GoogleGenAI;

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `${systemPrompt}\n\n${userMessage}`,
    });
    return response.text ?? "";
  }
}

export async function embedText(text: string, apiKey: string): Promise<number[]> {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  const values = response.embeddings?.[0]?.values;
  if (!values) throw new Error("No embedding returned from Gemini");
  return values;
}
