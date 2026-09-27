/**
 * ─────────────────────────────────────────────────────────────────────
 *  KV — tiny key-value layer for quotas, profiles & subscriptions.
 *  Production: Upstash Redis (REST — serverless-friendly, free tier).
 *  Dev/fallback: in-memory Map so everything works with zero setup.
 * ─────────────────────────────────────────────────────────────────────
 */

const URL = process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const useUpstash = Boolean(URL && TOKEN);

const mem = new Map<string, { v: string; exp?: number }>();

function memGet(k: string): string | null {
  const e = mem.get(k);
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) {
    mem.delete(k);
    return null;
  }
  return e.v;
}

async function cmd(args: (string | number)[]): Promise<unknown> {
  if (!useUpstash) return null; // caller falls back to mem
  const res = await fetch(`${URL}/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`KV_HTTP_${res.status}`);
  const j = (await res.json()) as { result?: unknown; error?: string };
  if (j.error) throw new Error(`KV_ERR: ${j.error}`);
  return j.result;
}

export const kv = {
  async get(key: string): Promise<string | null> {
    if (!useUpstash) return memGet(key);
    try {
      const r = await cmd(["GET", key]);
      return r === null || r === undefined ? null : String(r);
    } catch {
      return memGet(key);
    }
  },

  async set(key: string, value: string, expireSec?: number): Promise<void> {
    if (!useUpstash) {
      mem.set(key, { v: value, exp: expireSec ? Date.now() + expireSec * 1000 : undefined });
      return;
    }
    try {
      await cmd(expireSec ? ["SET", key, value, "EX", expireSec] : ["SET", key, value]);
    } catch {
      mem.set(key, { v: value, exp: expireSec ? Date.now() + expireSec * 1000 : undefined });
    }
  },

  async incr(key: string, expireSec?: number): Promise<number> {
    if (!useUpstash) {
      const cur = Number(memGet(key) ?? 0) + 1;
      mem.set(key, { v: String(cur), exp: expireSec ? Date.now() + expireSec * 1000 : undefined });
      return cur;
    }
    try {
      const r = Number(await cmd(["INCR", key]));
      if (expireSec && r === 1) await cmd(["EXPIRE", key, expireSec]);
      return r;
    } catch {
      const cur = Number(memGet(key) ?? 0) + 1;
      mem.set(key, { v: String(cur), exp: expireSec ? Date.now() + expireSec * 1000 : undefined });
      return cur;
    }
  },

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJson(key: string, value: unknown, expireSec?: number): Promise<void> {
    await kv.set(key, JSON.stringify(value), expireSec);
  },
};
