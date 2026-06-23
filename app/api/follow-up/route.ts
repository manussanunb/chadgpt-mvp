import { NextRequest, NextResponse } from "next/server";
import { GeminiProvider } from "@/engine/providers/gemini";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import type { FollowUpRequest, FollowUpResponse } from "@/engine/types";

export const maxDuration = 15;

const FOLLOW_UP_SYSTEM_PROMPT = `คุณช่วยสร้างคำถามต่อเนื่อง 3 ข้อสำหรับผู้ใช้ที่คุยเรื่องนโยบายกรุงเทพมหานคร
กฎ:
- ตอบเป็นภาษาไทยเท่านั้น
- แต่ละคำถามสั้นกระชับ ไม่เกิน 60 ตัวอักษร
- คำถามต้องเกี่ยวข้องกับเนื้อหาในคำถามและคำตอบที่ได้รับ
- ส่งกลับเป็น JSON array เท่านั้น ตัวอย่าง: ["คำถาม1", "คำถาม2", "คำถาม3"]
- ห้ามใส่ข้อความอื่นนอกจาก JSON array`;

function parseFollowUpQuestions(raw: string): string[] {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
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

export async function POST(req: NextRequest): Promise<NextResponse<FollowUpResponse>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ followUpQuestions: [] });
  }

  const { question, answer } = (body ?? {}) as Partial<FollowUpRequest>;

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
    return NextResponse.json({ followUpQuestions: [] });
  }

  try {
    const provider = new GeminiProvider(apiKey, undefined, "gemini-2.5-flash-lite");
    const userMessage = `คำถามเดิม: ${question.trim()}\nคำตอบที่ได้รับ: ${answer.trim()}`;
    const raw = await provider.generate(FOLLOW_UP_SYSTEM_PROMPT, userMessage);
    return NextResponse.json({ followUpQuestions: parseFollowUpQuestions(raw) });
  } catch {
    return NextResponse.json({ followUpQuestions: [] });
  }
}
