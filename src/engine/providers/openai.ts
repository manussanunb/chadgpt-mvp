import OpenAI from "openai";
import type { LLMProvider } from "@/engine/types";

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const completion = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });
    return completion.choices[0]?.message?.content ?? "";
  }
}
