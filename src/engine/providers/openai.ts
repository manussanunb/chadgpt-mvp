import OpenAI from "openai";
import type { LLMProvider } from "@/engine/types";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, options?: { baseURL?: string; model?: string }) {
    this.client = new OpenAI({ apiKey, baseURL: options?.baseURL });
    this.model = options?.model ?? "gpt-4o-mini";
  }

  async generate(systemPrompt: string, userMessage: string, _distinctId?: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    return completion.choices[0]?.message?.content ?? "";
  }
}
