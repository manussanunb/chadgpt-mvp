import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/adapters/vercel";
import type { ChatRequest } from "@/engine/types";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { message } = body as Partial<ChatRequest>;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  if (message.length > 500) {
    return NextResponse.json(
      { error: "message must be 500 characters or fewer" },
      { status: 400 }
    );
  }

  try {
    const response = await handleChat({ message: message.trim() });
    return NextResponse.json(response);
  } catch (err) {
    console.error("[chat] Error:", err);
    return NextResponse.json(
      { error: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
