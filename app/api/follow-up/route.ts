import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import type { FollowUpRequest, FollowUpResponse } from "@/engine/types";

export const maxDuration = 15;

const MODEL_LITE = "gemini-3.1-flash-lite";
const MODEL_FALLBACK = "gemini-2.5-flash";

const FOLLOW_UP_SYSTEM_PROMPT = `You are a helpful assistant that generates follow-up questions for users chatting about Bangkok city policies and the work of Governor Chadchart Sittipunt.

Given a user question, an AI assistant's answer, and the relevant policy/progress data that was used to generate the answer, generate exactly 3 follow-up questions that explore topics covered in or closely related to the provided data.

Rules:
- Questions must be grounded in the provided policy/progress context — only ask about things the data can actually answer.
- Write every question in Thai. English technical or management terms may appear naturally within a Thai sentence (e.g. "Budget", "Action Plan", "Timeline"), but the sentence structure must be Thai.
- Each question must be concise — no longer than 60 characters.
- Do NOT include polite particles such as ครับ, ค่ะ, or ฮะ anywhere in the questions.
- Return a JSON array of exactly 3 strings.`;

function parseFollowUpQuestions(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string" && item.length > 0)
      .slice(0, 3)
      .filter((q) => q.length <= 80);
  } catch {
    // Fallback: try extracting a JSON array from a larger string
    const match = raw.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    try {
      const parsed: unknown = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .slice(0, 3)
        .filter((q) => q.length <= 80);
    } catch {
      return [];
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<FollowUpResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ followUpQuestions: [] });
  }

  const { question, answer, ragContext } = (body ?? {}) as Partial<FollowUpRequest>;

  if (
    !question || typeof question !== "string" || question.trim().length === 0 ||
    !answer || typeof answer !== "string" || answer.trim().length === 0
  ) {
    return NextResponse.json({ followUpQuestions: [] });
  }

  if (question.length > 500 || answer.length > 3000) {
    return NextResponse.json({ followUpQuestions: [] });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json({ followUpQuestions: [] });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[follow-up] GEMINI_API_KEY is not set");
    return NextResponse.json({ followUpQuestions: [] });
  }

  const ai = new GoogleGenAI({ apiKey });
  const contextBlock = ragContext
    ? `\n\nRelevant policy/progress data used to generate the answer:\n${ragContext}`
    : "";
  const userMessage = `User question: ${question.trim()}\n\nAI answer: ${answer.trim()}${contextBlock}`;
  const genConfig = {
    temperature: 0.2,
    systemInstruction: FOLLOW_UP_SYSTEM_PROMPT,
    responseMimeType: "application/json",
  };

  // Try lite model with up to 3 retries on 503, then fall back to full model
  const modelsToTry = [MODEL_LITE, MODEL_LITE, MODEL_LITE, MODEL_FALLBACK];
  for (let attempt = 0; attempt < modelsToTry.length; attempt++) {
    const model = modelsToTry[attempt];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: userMessage,
        config: genConfig,
      });
      const raw = response.text ?? "[]";
      return NextResponse.json({ followUpQuestions: parseFollowUpQuestions(raw) });
    } catch (err) {
      const status = (err as { status?: number }).status;
      const isRetryable = status === 503 || status === 429;
      const hasMoreAttempts = attempt < modelsToTry.length - 1;

      if (isRetryable && hasMoreAttempts) {
        // 1s constant delay between retries; no delay before switching to fallback model
        const nextModel = modelsToTry[attempt + 1];
        if (nextModel === model) await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      console.error(`[follow-up] Error on model ${model}:`, err);
      return NextResponse.json({ followUpQuestions: [] });
    }
  }

  return NextResponse.json({ followUpQuestions: [] });
}
