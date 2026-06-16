import { GoogleGenAI } from "@google/genai";
import { PostHogGoogleGenAI } from "@posthog/ai/gemini";
import type { PostHog } from "posthog-node";
import type { LLMProvider } from "@/engine/types";

export class GeminiProvider implements LLMProvider {
  private ai: PostHogGoogleGenAI | GoogleGenAI;
  private tracked: boolean;

  constructor(apiKey: string, posthog?: PostHog) {
    if (posthog) {
      this.ai = new PostHogGoogleGenAI({ apiKey, posthog });
      this.tracked = true;
    } else {
      this.ai = new GoogleGenAI({ apiKey });
      this.tracked = false;
    }
  }

  async generate(systemPrompt: string, userMessage: string, distinctId = "anonymous"): Promise<string> {
    const params = {
      model: "gemini-2.5-flash",
      contents: `${systemPrompt}\n\n${userMessage}`,
      ...(this.tracked ? { posthogDistinctId: distinctId } : {}),
    };
    const response = await this.ai.models.generateContent(params);
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
