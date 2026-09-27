/**
 * ─────────────────────────────────────────────────────────────────────
 *  Security helpers: per-identity rate limits (KV-backed, so they work
 *  across serverless instances) + same-origin guards for mutating APIs.
 * ─────────────────────────────────────────────────────────────────────
 */
import { kv } from "./kv";
import { NextRequest } from "next/server";

/** Sliding-window-ish fixed-window rate limit. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<{ ok: boolean; left: number }> {
  const bucket = `rl:${key}:${Math.floor(Date.now() / (windowSec * 1000))}`;
  const n = await kv.incr(bucket, windowSec + 60);
  return { ok: n <= max, left: Math.max(0, max - n) };
}

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Reject cross-site POSTs (CSRF belt for our own JSON APIs). */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin/curl/server calls omit it
  try {
    const o = new URL(origin);
    const host = req.headers.get("host") || "";
    return o.host === host;
  } catch {
    return false;
  }
}

/** Security headers applied to every response (see next.config.mjs). */
export const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
} as const;
