/**
 * ─────────────────────────────────────────────────────────────────────
 *  Tiny LRU cache for TTS audio + generated scripts.
 *  Memory-backed by default; REDIS_URL is reserved for a drop-in Redis
 *  store in multi-instance deployments (see README → Scaling).
 * ─────────────────────────────────────────────────────────────────────
 */
import { createHash } from "crypto";

export const sha256 = (...parts: (string | number | undefined)[]) =>
  createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);

interface Entry<T> {
  value: T;
  bytes: number;
  at: number;
}

export class LruCache<T> {
  private map = new Map<string, Entry<T>>();
  private totalBytes = 0;

  constructor(private maxEntries = 120, private maxBytes = 96 * 1024 * 1024) {}

  get(key: string): T | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    e.at = Date.now();
    return e.value;
  }

  set(key: string, value: T, bytes = 0): void {
    if (this.map.has(key)) this.evictKey(key);
    this.map.set(key, { value, bytes, at: Date.now() });
    this.totalBytes += bytes;
    this.gc();
  }

  private evictKey(key: string) {
    const e = this.map.get(key);
    if (e) {
      this.totalBytes -= e.bytes;
      this.map.delete(key);
    }
  }

  /** Drop oldest entries until under both caps. */
  private gc() {
    while (this.map.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      let oldestKey: string | null = null;
      let oldestAt = Infinity;
      for (const [k, e] of this.map) {
        if (e.at < oldestAt) {
          oldestAt = e.at;
          oldestKey = k;
        }
      }
      if (!oldestKey) break;
      this.evictKey(oldestKey);
    }
  }

  stats() {
    return { entries: this.map.size, bytes: this.totalBytes };
  }
}

/** Global across hot-reloads in dev (module registry pattern). */
const g = globalThis as unknown as { __arenaCaches?: Record<string, LruCache<unknown>> };
g.__arenaCaches ??= {};

export function getCache<T>(name: string): LruCache<T> {
  g.__arenaCaches![name] ??= new LruCache<T>() as LruCache<unknown>;
  return g.__arenaCaches![name] as LruCache<T>;
}
