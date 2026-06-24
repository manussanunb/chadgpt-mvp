import type { LLMProvider } from "@/engine/types";

function isQuotaError(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 429;
}

export class CascadeProvider implements LLMProvider {
  constructor(private providers: LLMProvider[]) {
    if (providers.length === 0) throw new Error("CascadeProvider requires at least one provider");
  }

  async generate(systemPrompt: string, userMessage: string, distinctId?: string): Promise<string> {
    let lastError: unknown;
    for (let i = 0; i < this.providers.length; i++) {
      try {
        return await this.providers[i].generate(systemPrompt, userMessage, distinctId);
      } catch (err) {
        if (isQuotaError(err)) {
          lastError = err;
          if (i < this.providers.length - 1) {
            console.warn(`[cascade] provider ${i} rate-limited, falling to next`);
          }
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }
}
