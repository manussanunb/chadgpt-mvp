import Anthropic from "@anthropic-ai/sdk";
import type { LLMProvider } from "@/engine/types";

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generate(systemPrompt: string, userMessage: string): Promise<string> {
    const message = await this.client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
    const block = message.content[0];
    return block.type === "text" ? block.text : "";
  }
}
