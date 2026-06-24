import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/adapters/vercel";
import { getPostHogClient } from "@/lib/posthog-server";
import { isRateLimited, getClientIp } from "@/lib/rate-limit";
import type { ChatRequest } from "@/engine/types";

export const maxDuration = 30;

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true; // Turnstile not configured — skip in dev
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const data = (await res.json()) as { success: boolean };
  return data.success;
}

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

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "ส่งข้อความบ่อยเกินไปครับ กรุณารอสักครู่แล้วลองใหม่" },
      { status: 429 }
    );
  }

  const turnstileToken = req.headers.get("x-turnstile-token");
  if (process.env.TURNSTILE_SECRET_KEY && process.env.NODE_ENV !== "development") {
    if (!turnstileToken || !(await verifyTurnstile(turnstileToken, ip))) {
      return NextResponse.json({ error: "การยืนยันตัวตนล้มเหลว กรุณาลองใหม่" }, { status: 403 });
    }
  }

  const posthog = getPostHogClient();
  const rawDistinctId = req.headers.get("x-posthog-distinct-id") ?? "anonymous";
  const distinctId = rawDistinctId.slice(0, 64).replace(/[^\w-]/g, "_");
  const start = Date.now();

  try {
    const response = await handleChat({ message: message.trim(), distinctId });
    posthog.capture({
      distinctId,
      event: "chat_completed",
      properties: {
        message_length: message.trim().length,
        had_rag_context: response.sources.length > 0,
        source_count: response.sources.length,
        response_time_ms: Date.now() - start,
      },
    });
    return NextResponse.json(response);
  } catch (err) {
    const isQuotaExhausted = (err as { status?: number }).status === 429;
    console.error(`[chat] ${isQuotaExhausted ? "All providers quota exceeded" : "Error"}:`, err);
    posthog.capture({
      distinctId,
      event: "chat_api_error",
      properties: {
        error: err instanceof Error ? err.message : String(err),
        quota_exhausted: isQuotaExhausted,
        response_time_ms: Date.now() - start,
      },
    });
    if (isQuotaExhausted) {
      return NextResponse.json(
        { error: "ขออภัยครับ ระบบมีผู้ใช้งานเยอะในขณะนี้ กรุณาลองใหม่ในอีกสักครู่" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
