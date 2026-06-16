import { NextRequest, NextResponse } from "next/server";
import { handleChat } from "@/adapters/vercel";
import { getPostHogClient } from "@/lib/posthog-server";
import type { ChatRequest } from "@/engine/types";

export const maxDuration = 30;

const RATE_LIMIT = 5;
const WINDOW_MS = 60_000;
const ipTimestamps = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
  return false;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}

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
  const distinctId = req.headers.get("x-posthog-distinct-id") ?? "anonymous";
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
    console.error("[chat] Error:", err);
    posthog.capture({
      distinctId,
      event: "chat_api_error",
      properties: {
        error: err instanceof Error ? err.message : String(err),
        response_time_ms: Date.now() - start,
      },
    });
    return NextResponse.json(
      { error: "ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง" },
      { status: 500 }
    );
  }
}
