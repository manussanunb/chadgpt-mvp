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
      config: { temperature: 0.7 },
      ...(this.tracked ? { posthogDistinctId: distinctId } : {}),
    };

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await this.ai.models.generateContent(params);
        return response.text ?? "";
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 503 && attempt < maxRetries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
        throw err;
      }
    }
    throw new Error("Unreachable");
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
