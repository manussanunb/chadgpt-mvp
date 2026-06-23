import type { NextRequest } from "next/server";

const RATE_LIMIT = 5;
const WINDOW_MS = 60_000;
const ipTimestamps = new Map<string, number[]>();

let lastCleanup = Date.now();

export function isRateLimited(ip: string): boolean {
  const now = Date.now();

  if (now - lastCleanup > 5 * 60_000) {
    for (const [key, ts] of ipTimestamps) {
      if (ts.every((t) => now - t >= WINDOW_MS)) ipTimestamps.delete(key);
    }
    lastCleanup = now;
  }

  const timestamps = (ipTimestamps.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return true;
  timestamps.push(now);
  ipTimestamps.set(ip, timestamps);
  return false;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
